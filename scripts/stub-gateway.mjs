#!/usr/bin/env node
/**
 * dev-only 抽取式桩网关（strict-rag-stub）。
 *
 * 定位：让 `smoke:half` 的末步 ask 有一条**零 apps/ 代码改动**的可重复通路，
 * 只服务 generate / claim_split / judge / embed / rerank 五个 purpose 的最小形状。
 *
 * 硬口径：
 * - 只证明「管道接对」，**不是**质量证据，**不得**进签字包；
 * - 只从提示里的 EVIDENCE 抽取：citations 必须逐字取自 evidence 行的 chunkId；
 *   证据不足以回答时返回 insufficient:true（系统据此 abstain）；
 * - 确定性：同输入同输出，不得使用随机数或时间戳参与任何响应内容；
 * - 生产档位（APP_ENV/NODE_ENV=production）拒绝启动。
 *
 *   node scripts/stub-gateway.mjs
 *   STUB_GATEWAY_PORT=4100 STUB_GATEWAY_EMBED_DIMS=8 node scripts/stub-gateway.mjs
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 4100;
const DEFAULT_DIMS = 8;
const VERSION = '1';
const PURPOSES = ['generate', 'claim_split', 'judge', 'embed', 'rerank'];

/** 把文本切成用于重叠打分的 token：ASCII 词 + CJK 单字与相邻双字。 */
function tokenize(text) {
  const s = String(text).toLowerCase();
  const tokens = [];
  for (const m of s.matchAll(/[a-z0-9_]+/g)) tokens.push(m[0]);
  for (const m of s.matchAll(/[\u4e00-\u9fff]+/g)) {
    const run = m[0];
    for (let i = 0; i < run.length; i++) {
      tokens.push(run[i]);
      if (i + 1 < run.length) tokens.push(run.slice(i, i + 2));
    }
  }
  return tokens;
}

function tokenSet(text) {
  return new Set(tokenize(text));
}

function overlapCount(a, b) {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

function splitSentences(text) {
  return String(text)
    .split(/[。！？!?；;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 取提示里两个小节之间的正文（用于不依赖整段格式的稳定抽取）。 */
function section(content, startHeader, endHeader) {
  const s = content.indexOf(startHeader);
  if (s < 0) return '';
  const after = content.slice(s + startHeader.length);
  const e = after.indexOf(endHeader);
  return e < 0 ? after : after.slice(0, e);
}

function extractQuestion(userContent) {
  const start = userContent.indexOf('QUESTION:');
  if (start < 0) return '';
  const after = userContent.slice(start + 'QUESTION:'.length);
  const end = after.indexOf('\nEVIDENCE:');
  return (end < 0 ? after : after.slice(0, end)).trim();
}

/** 解析 generateUserPrompt 的 EVIDENCE 段：每块 "[i] chunkId=… docId=… title=…\n<text>"。 */
function parseGenerateEvidence(userContent) {
  const idx = userContent.indexOf('EVIDENCE:');
  if (idx < 0) return [];
  const tail = userContent.slice(idx + 'EVIDENCE:'.length);
  const out = [];
  for (const raw of tail.split('\n---\n')) {
    const trimmed = raw.replace(/^\n+/, '');
    const nl = trimmed.indexOf('\n');
    const header = nl < 0 ? trimmed : trimmed.slice(0, nl);
    const text = nl < 0 ? '' : trimmed.slice(nl + 1);
    const m = header.match(/^\[(\d+)\]\s+chunkId=(\S+)\s+docId=(\S+)/);
    if (!m) continue;
    out.push({ chunkId: m[2], text: text.trim() });
  }
  return out;
}

/** 解析 claimSplitUserPrompt 的 EVIDENCE 段：每行 "chunkId: text"。 */
function parseClaimEvidence(userContent) {
  const idx = userContent.indexOf('EVIDENCE:');
  if (idx < 0) return new Map();
  const tail = userContent.slice(idx + 'EVIDENCE:'.length);
  const out = new Map();
  for (const line of tail.split('\n')) {
    const sep = line.indexOf(': ');
    if (sep < 0) continue;
    const id = line.slice(0, sep).trim();
    if (id) out.set(id, line.slice(sep + 2));
  }
  return out;
}

/** generate：只从 EVIDENCE 抽取与问题重叠度最高的证据句；无重叠即 insufficient。 */
function generate(userContent) {
  const question = extractQuestion(userContent);
  const qTokens = tokenSet(question);
  const picked = [];
  for (const block of parseGenerateEvidence(userContent)) {
    let best = null;
    for (const sent of splitSentences(block.text)) {
      const score = overlapCount(qTokens, tokenSet(sent));
      if (score > 0 && (!best || score > best.score)) best = { sent, score };
    }
    if (best) picked.push({ chunkId: block.chunkId, text: best.sent, score: best.score });
  }
  if (picked.length === 0) {
    return { answer: '', citations: [], insufficient: true };
  }
  picked.sort((a, b) => b.score - a.score);
  const top = picked.slice(0, 3);
  const answer = top.map((p) => p.text).join('');
  const citations = [];
  for (const p of top) if (!citations.includes(p.chunkId)) citations.push(p.chunkId);
  return { answer, citations, insufficient: false };
}

/** claim_split：把答案切成句级 claim，每条绑定一个 citations 内的 chunkId。 */
function claimSplit(userContent) {
  const answer = section(userContent, 'ANSWER:', 'CITATION_IDS:').trim();
  const citations = section(userContent, 'CITATION_IDS:', 'EVIDENCE:')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const evidence = parseClaimEvidence(userContent);
  const sentences = splitSentences(answer);
  const list = sentences.length ? sentences : answer ? [answer] : [];
  const claims = list.map((text) => {
    const cTokens = tokenSet(text);
    let bestId = citations[0];
    let bestScore = -1;
    for (const id of citations) {
      const score = overlapCount(cTokens, tokenSet(evidence.get(id) ?? ''));
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
    return { text, chunkIds: bestId ? [bestId] : [] };
  });
  return { claims };
}

/** judge：每条 claim 的支持分 = claim 的 token 有多少能在其证据文本里找到。 */
function judge(userContent) {
  const scores = [];
  for (const part of userContent.split('\n---\n')) {
    const nl = part.indexOf('\n');
    const claimLine = nl < 0 ? part : part.slice(0, nl);
    const evLine = nl < 0 ? '' : part.slice(nl + 1);
    if (!claimLine.startsWith('CLAIM[')) continue;
    const claimText = claimLine.slice(claimLine.indexOf(':') + 1).trim();
    const evText = evLine.startsWith('EVIDENCE:')
      ? evLine.slice('EVIDENCE:'.length)
      : evLine;
    const cUniq = tokenSet(claimText);
    const matched = overlapCount(cUniq, tokenSet(evText));
    const score = cUniq.size === 0 ? 0 : matched / cUniq.size;
    scores.push(Math.max(0, Math.min(1, score)));
  }
  return { scores };
}

/** 确定性伪向量：文本 FNV-1a 哈希 → PRNG 填维 → 归一化（同文本同向量）。 */
function embedVector(text, dims) {
  let seed = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  let state = seed || 1;
  const out = [];
  for (let i = 0; i < dims; i++) {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    out.push(((t ^ (t >>> 14)) >>> 0) / 4294967296);
  }
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}

/** rerank：按 query 与文档的 token 重叠确定性打分，返回全部（非空即入参非空）。 */
function rerankResults(query, documents) {
  const q = tokenSet(query);
  return documents
    .map((doc, index) => ({
      index,
      relevance_score: q.size === 0 ? 0 : overlapCount(q, tokenSet(String(doc))) / q.size,
    }))
    .sort((a, b) => b.relevance_score - a.relevance_score || a.index - b.index);
}

/** 按 messages[0].content（system prompt）分支 —— http 客户端不下发 purpose。 */
function chatPurposeFromSystem(system) {
  const s = typeof system === 'string' ? system : '';
  if (s.includes('"scores"')) return 'judge';
  if (s.includes('"claims"')) return 'claim_split';
  return 'generate';
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function createStubServer({ dims = DEFAULT_DIMS, quiet = false } = {}) {
  const log = (purpose, summary) => {
    if (!quiet) console.log(`[stub-gateway] purpose=${purpose} ${summary}`);
  };

  return http.createServer(async (req, res) => {
    let pathname = '/';
    try {
      pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

      if (req.method === 'GET' && pathname === '/__stub') {
        log('__stub', 'identity');
        return sendJson(res, 200, { stub: true, version: VERSION, purposes: PURPOSES });
      }
      if (req.method === 'GET' && pathname === '/v1/models') {
        log('models', 'list');
        return sendJson(res, 200, { data: [{ id: 'strict-rag-stub' }] });
      }
      if (
        req.method === 'POST' &&
        (pathname === '/chat/completions' || pathname === '/v1/chat/completions')
      ) {
        const body = await readJson(req);
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const system = messages[0]?.content ?? '';
        const user = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
        const purpose = chatPurposeFromSystem(system);
        let payload;
        if (purpose === 'claim_split') payload = claimSplit(user);
        else if (purpose === 'judge') payload = judge(user);
        else payload = generate(user);
        log(purpose, JSON.stringify(payload).slice(0, 160));
        return sendJson(res, 200, {
          choices: [{ message: { content: JSON.stringify(payload) } }],
        });
      }
      if (
        req.method === 'POST' &&
        (pathname === '/embeddings' || pathname === '/v1/embeddings')
      ) {
        const body = await readJson(req);
        const input = Array.isArray(body.input) ? body.input : [];
        const data = input.map((t, index) => ({ embedding: embedVector(String(t), dims), index }));
        log('embed', `count=${data.length} dims=${dims}`);
        return sendJson(res, 200, { data });
      }
      if (req.method === 'POST' && pathname === '/rerank') {
        const body = await readJson(req);
        const query = String(body.query ?? '');
        const documents = Array.isArray(body.documents) ? body.documents : [];
        const results = rerankResults(query, documents);
        log('rerank', `docs=${documents.length} results=${results.length}`);
        return sendJson(res, 200, { results });
      }

      log('unknown', `${req.method} ${pathname}`);
      return sendJson(res, 404, { error: 'not_found', path: pathname });
    } catch (err) {
      return sendJson(res, 400, {
        error: 'bad_request',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
}

function printBanner(port, dims) {
  const lines = [
    '='.repeat(64),
    ' dev-only 桩网关 · strict-rag-stub',
    ' · 只证明管道接对，不是质量证据，不得进签字包',
    ' · 只从提示里的 EVIDENCE 抽取；证据不足即 insufficient:true',
    ' · 生产档位（APP_ENV/NODE_ENV=production）拒绝启动',
    ` · 监听 http://127.0.0.1:${port} · embed dims=${dims}`,
    '='.repeat(64),
  ];
  for (const line of lines) console.log(line);
}

export function main() {
  const appEnv = process.env.APP_ENV ?? '';
  const nodeEnv = process.env.NODE_ENV ?? '';
  if (appEnv === 'production' || nodeEnv === 'production') {
    console.error(
      '[stub-gateway] 拒绝启动：检测到生产档位 ' +
        `(APP_ENV=${appEnv || 'unset'} NODE_ENV=${nodeEnv || 'unset'})。` +
        '本桩是 dev-only 抽取式假网关，只证明管道接对，不得在生产环境运行。',
    );
    process.exit(1);
  }

  const port = Number(process.env.STUB_GATEWAY_PORT ?? DEFAULT_PORT);
  const dims = Number(process.env.STUB_GATEWAY_EMBED_DIMS ?? DEFAULT_DIMS);
  printBanner(port, dims);
  const server = createStubServer({ dims });
  server.listen(port, '127.0.0.1', () => {
    console.log(`[stub-gateway] listening on http://127.0.0.1:${port}`);
  });
  return server;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
