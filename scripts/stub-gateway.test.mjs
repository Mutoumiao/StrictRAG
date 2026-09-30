/**
 * dev-only 桩网关契约测例。
 *
 * 目标：护住 scripts/stub-gateway.mjs 的五个 purpose 最小响应形状、抽取式约束
 * （citations 必须来自 EVIDENCE、无证据即 insufficient）、确定性、双 /v1 前缀与生产护栏。
 * 这是「仓库脚本本身」的契约，不进任何 app 的 tests/<能力>/（见 docs/testing/README.md）。
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createStubServer } from './stub-gateway.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STUB_PATH = path.join(repoRoot, 'scripts', 'stub-gateway.mjs');

// 与 apps/api/src/graph/prompts.ts 三个 system prompt 同文（桩据此分支）。
const GENERATE_SYS = [
  '你是企业知识库助手。仅依据提供的 EVIDENCE 作答。',
  '输出严格 JSON 单行对象，无 markdown：',
  '{"answer":"string","citations":["chunkId",...],"insufficient":false}',
  '若证据不足以可靠回答：{"answer":"","citations":[],"insufficient":true}',
  'citations 中 chunkId 必须来自 EVIDENCE 列表；禁止编造。',
  '禁止使用会话历史；历史不是证据。',
].join('\n');
const CLAIM_SPLIT_SYS = [
  '将答案拆成可验证原子 claim。输出严格 JSON：',
  '{"claims":[{"text":"...","chunkIds":["chunkId"]}]}',
  '每个 claim 至少绑定一个 citations 中的 chunkId；禁止空 claims。',
].join('\n');
const JUDGE_SYS = [
  '对每个 claim 给出 0~1 支持分（相对 EVIDENCE）。输出严格 JSON：',
  '{"scores":[0.0,...]}',
  'scores 长度必须等于 claims 数量；禁止均值洗白指令。',
].join('\n');

async function withStub(fn, options) {
  const server = createStubServer({ quiet: true, ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function chat(base, system, user, pathName = '/chat/completions') {
  const res = await fetch(`${base}${pathName}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'strict-rag-stub',
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  return { content: json.choices[0].message.content, parsed: JSON.parse(json.choices[0].message.content) };
}

test('身份：GET /__stub 自证 stub:true；GET /v1/models 形状对；未知路径 404', async () => {
  await withStub(async (base) => {
    const id = await (await fetch(`${base}/__stub`)).json();
    assert.equal(id.stub, true);
    assert.equal(typeof id.version, 'string');
    assert.ok(Array.isArray(id.purposes));
    for (const p of ['generate', 'claim_split', 'judge', 'embed', 'rerank']) {
      assert.ok(id.purposes.includes(p), `purposes 缺 ${p}`);
    }

    const models = await (await fetch(`${base}/v1/models`)).json();
    assert.ok(Array.isArray(models.data));
    assert.equal(models.data[0].id, 'strict-rag-stub');

    const missing = await fetch(`${base}/nope`);
    assert.equal(missing.status, 404);
  });
});

test('generate：citations 全部逐字来自 EVIDENCE 的 chunkId', async () => {
  await withStub(async (base) => {
    const user = [
      'QUESTION:',
      '检索闸对哪些文档生效？',
      '',
      'EVIDENCE:',
      '[0] chunkId=chk-a docId=doc-a title=',
      '检索闸仅对 ready 且 active 文档生效，draft 与 superseded 不得进入默认检索集合。',
      '---',
      '[1] chunkId=chk-b docId=doc-b title=',
      '完全无关的另一段内容。',
    ].join('\n');
    const { parsed } = await chat(base, GENERATE_SYS, user);
    assert.equal(parsed.insufficient, false);
    assert.ok(parsed.answer.length > 0);
    assert.ok(parsed.citations.length > 0);
    const evidenceIds = new Set(['chk-a', 'chk-b']);
    for (const c of parsed.citations) {
      assert.ok(evidenceIds.has(c), `citation ${c} 不在 EVIDENCE 行`);
    }
    assert.ok(parsed.citations.includes('chk-a'));
  });
});

test('generate：无 EVIDENCE / 零重叠 → insufficient:true 且 citations 为空', async () => {
  await withStub(async (base) => {
    const noEvidence = 'QUESTION:\n检索闸对哪些文档生效？';
    const a = await chat(base, GENERATE_SYS, noEvidence);
    assert.equal(a.parsed.insufficient, true);
    assert.deepEqual(a.parsed.citations, []);
    assert.equal(a.parsed.answer, '');

    const zeroOverlap = [
      'QUESTION:',
      '检索闸对哪些文档生效？',
      '',
      'EVIDENCE:',
      '[0] chunkId=chk-z docId=doc-z title=',
      '完全无关的另一段内容。',
    ].join('\n');
    const b = await chat(base, GENERATE_SYS, zeroOverlap);
    assert.equal(b.parsed.insufficient, true);
    assert.deepEqual(b.parsed.citations, []);
  });
});

test('claim_split / judge：形状正确，chunkIds ⊂ citations，scores 长度 === claims 数', async () => {
  await withStub(async (base) => {
    const genUser = [
      'QUESTION:',
      '检索闸对哪些文档生效？',
      '',
      'EVIDENCE:',
      '[0] chunkId=chk-a docId=doc-a title=',
      '检索闸仅对 ready 且 active 文档生效。',
    ].join('\n');
    const gen = (await chat(base, GENERATE_SYS, genUser)).parsed;
    const citations = gen.citations;

    const splitUser = [
      `ANSWER:\n${gen.answer}`,
      '',
      `CITATION_IDS:\n${citations.join(', ')}`,
      '',
      `EVIDENCE:\n${citations.map((id) => `${id}: 检索闸仅对 ready 且 active 文档生效。`).join('\n')}`,
    ].join('\n');
    const split = (await chat(base, CLAIM_SPLIT_SYS, splitUser)).parsed;
    assert.ok(Array.isArray(split.claims) && split.claims.length > 0);
    const citationSet = new Set(citations);
    for (const c of split.claims) {
      assert.equal(typeof c.text, 'string');
      assert.ok(c.text.length > 0);
      assert.ok(Array.isArray(c.chunkIds) && c.chunkIds.length > 0);
      for (const id of c.chunkIds) {
        assert.ok(citationSet.has(id), `claim chunkId ${id} 不在 citations 内`);
      }
    }

    const judgeUser = split.claims
      .map((c) => `CLAIM[${0}]: ${c.text}\nEVIDENCE: 检索闸仅对 ready 且 active 文档生效。`)
      .join('\n---\n');
    const judged = (await chat(base, JUDGE_SYS, judgeUser)).parsed;
    assert.ok(Array.isArray(judged.scores));
    assert.equal(judged.scores.length, split.claims.length);
    for (const s of judged.scores) {
      assert.equal(typeof s, 'number');
      assert.ok(s >= 0 && s <= 1, `score ${s} 越界`);
    }
    // 抽取式 ⇒ 支持分自然偏高（足以过 min 否决）
    assert.ok(judged.scores.every((s) => s >= 0.5));
  });
});

test('judge：scores 长度随 claims 数变化（非常量）', async () => {
  await withStub(async (base) => {
    const two = 'CLAIM[0]: 甲\nEVIDENCE: 甲\n---\nCLAIM[1]: 乙\nEVIDENCE: 乙';
    const three = `${two}\n---\nCLAIM[2]: 丙\nEVIDENCE: 丙`;
    const a = (await chat(base, JUDGE_SYS, two)).parsed;
    const b = (await chat(base, JUDGE_SYS, three)).parsed;
    assert.equal(a.scores.length, 2);
    assert.equal(b.scores.length, 3);
  });
});

test('embed：条数 === 入参条数、维度 === dims、同文本同向量、异文本异向量', async () => {
  await withStub(async (base) => {
    const post = async (texts, pathName) => {
      const res = await fetch(`${base}${pathName}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'strict-rag-stub', input: texts }),
      });
      assert.equal(res.status, 200);
      return (await res.json()).data;
    };
    const texts = ['检索闸对哪些文档生效？', '另一段完全不同的文本'];
    const data = await post(texts, '/embeddings');
    assert.equal(data.length, texts.length);
    for (const row of data) {
      assert.equal(row.embedding.length, 8);
      assert.equal(typeof row.index, 'number');
    }
    assert.notDeepEqual(data[0].embedding, data[1].embedding);

    const again = await post(texts, '/embeddings');
    assert.deepEqual(data, again);
  });
});

test('rerank：results 非空、index 合法、按 query 确定性打分', async () => {
  await withStub(async (base) => {
    const post = async () => {
      const res = await fetch(`${base}/rerank`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'strict-rag-stub',
          query: '检索闸 ready active',
          documents: ['检索闸仅对 ready 且 active 文档生效。', '无关内容。'],
          top_n: 10,
        }),
      });
      assert.equal(res.status, 200);
      return (await res.json()).results;
    };
    const results = await post();
    assert.ok(results.length > 0);
    for (const r of results) {
      assert.ok(Number.isInteger(r.index) && r.index >= 0 && r.index < 2);
      assert.ok(typeof r.relevance_score === 'number');
      assert.ok(r.relevance_score >= 0 && r.relevance_score <= 1);
    }
    assert.deepEqual(results, await post());
  });
});

test('双前缀：/embeddings 与 /v1/embeddings 两条路径都能用', async () => {
  await withStub(async (base) => {
    for (const pathName of ['/embeddings', '/v1/embeddings']) {
      const res = await fetch(`${base}${pathName}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'strict-rag-stub', input: ['x'] }),
      });
      assert.equal(res.status, 200, `${pathName} 应可用`);
      const data = (await res.json()).data;
      assert.equal(data.length, 1);
      assert.equal(data[0].embedding.length, 8);
    }
  });
});

test('生产护栏：APP_ENV=production 起进程 → 拒绝启动（非零退出 + stderr 有原因）', async () => {
  const child = spawn(process.execPath, [STUB_PATH], {
    env: { ...process.env, APP_ENV: 'production', NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const code = await new Promise((resolve) => child.on('exit', resolve));
  assert.notEqual(code, 0);
  assert.match(stderr, /拒绝启动/);
});
