/**
 * L1 情境前缀（PRD 04-pipelines §4）：OpenAI 兼容 chat，`purpose=contextualize`，temp=0。
 * 失败一律抛 —— 调用方（chunk 段）回退 L0 并记 `l0_fallback`，块仍可索引。
 * worker 禁止 import apps/api；本模块只做 HTTP，不引厂商 SDK。
 */

/** PRD §4.1「文档摘要/前缀 最多 N 字」的本仓取值（模板字段，非阈值闸） */
export const CONTEXTUALIZE_DOC_EXCERPT_MAX = 200;

/**
 * PRD §4「输出 ≤25 词单句」折算的字符上限：超限视为不合格输出 → 抛错回退 L0。
 * 目的是不让模型把长文当前缀写进 `contextPrefix`（会被 embed 与稀疏文本一起吃进去）。
 */
export const CONTEXTUALIZE_OUTPUT_MAX_CHARS = 200;

/** PRD §4.1 冻结提示模板（labels 逐字保留） */
export const CONTEXTUALIZE_SYSTEM_PROMPT =
  '你是企业知识库的入库助手。为给定的切片生成一句情境前缀，让该切片脱离原文也能被看懂。只输出这一句，不要引号与解释。';

export function buildContextualizeUserPrompt(input: {
  title: string;
  docExcerpt?: string;
  chunk: string;
}): string {
  const excerpt = (input.docExcerpt ?? '').trim();
  return [
    `文档标题: ${input.title.trim()}`,
    `文档摘要/前缀: ${excerpt.length > 0 ? excerpt : '（无）'}`,
    `块正文: ${input.chunk}`,
  ].join('\n');
}

/** 只留单行：去引号、压空白。空结果视为失败。 */
function normalizePrefix(raw: string): string {
  const oneLine = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join(' ')
    .replace(/^["'“”「」]+|["'“”「」]+$/g, '')
    .trim();
  if (oneLine.length === 0) {
    throw new Error('contextualize: empty output');
  }
  if (oneLine.length > CONTEXTUALIZE_OUTPUT_MAX_CHARS) {
    throw new Error(
      `contextualize: output too long (${oneLine.length} > ${CONTEXTUALIZE_OUTPUT_MAX_CHARS})`,
    );
  }
  return oneLine;
}

/**
 * 调 Gateway 生成一条情境前缀。任何异常都抛出（含无 baseUrl / 非 2xx / 空或过长输出），
 * 由调用方回退 L0 —— **禁止**在这里静默返回空串冒充成功。
 */
export async function contextualizeChunk(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  title: string;
  docExcerpt?: string;
  chunk: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  if (!opts.baseUrl.trim()) {
    throw new Error('GATEWAY_BASE_URL required for INGEST_CONTEXTUALIZE_MODE=http');
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(`${opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0,
      messages: [
        { role: 'system', content: CONTEXTUALIZE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildContextualizeUserPrompt({
            title: opts.title,
            docExcerpt: opts.docExcerpt,
            chunk: opts.chunk,
          }),
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`contextualize HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('contextualize: malformed response');
  }
  return normalizePrefix(content);
}
