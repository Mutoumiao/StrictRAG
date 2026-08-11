/**
 * OPS-1 / B8 切片：真 ES sparse 检索（fetch，无新依赖）。
 * 非目标：IK、多租户 Router、入库双写。
 */

export type EsSparseConfig = {
  baseUrl: string;
  index: string;
  /** ms；默认 10s */
  timeoutMs?: number;
};

export type EsSparseSearchInput = {
  kbId: string;
  question: string;
  size: number;
};

export class EsSparseError extends Error {
  constructor(
    message: string,
    readonly kind: 'config' | 'http' | 'parse' | 'timeout',
  ) {
    super(message);
    this.name = 'EsSparseError';
  }
}

function trimUrl(url: string): string {
  return url.replace(/\/$/, '');
}

/** 确保索引存在（幂等）；映射为签字 live 最小字段 */
export async function ensureSparseIndex(cfg: EsSparseConfig): Promise<void> {
  const base = trimUrl(cfg.baseUrl);
  const index = cfg.index;
  const timeoutMs = cfg.timeoutMs ?? 10_000;
  const head = await fetch(`${base}/${encodeURIComponent(index)}`, {
    method: 'HEAD',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (head.ok) return;
  if (head.status !== 404) {
    throw new EsSparseError(`ES HEAD index failed: ${head.status}`, 'http');
  }
  const put = await fetch(`${base}/${encodeURIComponent(index)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      mappings: {
        properties: {
          chunkId: { type: 'keyword' },
          kbId: { type: 'keyword' },
          docId: { type: 'keyword' },
          sparseText: { type: 'text' },
        },
      },
    }),
  });
  if (!put.ok) {
    const body = await put.text().catch(() => '');
    throw new EsSparseError(`ES create index failed: ${put.status} ${body.slice(0, 200)}`, 'http');
  }
}

/**
 * BM25 sparse：按 kbId 过滤 + match sparseText。
 * 返回有序 chunkId 列表（_id 优先，否则 source.chunkId）。
 */
export async function searchSparseEs(
  cfg: EsSparseConfig,
  input: EsSparseSearchInput,
): Promise<string[]> {
  const base = trimUrl(cfg.baseUrl);
  if (!base) {
    throw new EsSparseError('ELASTICSEARCH_URL empty', 'config');
  }
  const size = Math.max(1, Math.min(input.size, 500));
  const timeoutMs = cfg.timeoutMs ?? 10_000;
  let res: Response;
  try {
    res = await fetch(`${base}/${encodeURIComponent(cfg.index)}/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        size,
        query: {
          bool: {
            filter: [{ term: { kbId: input.kbId } }],
            must: [{ match: { sparseText: input.question } }],
          },
        },
        _source: ['chunkId'],
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const kind = msg.includes('Timeout') || msg.includes('abort') ? 'timeout' : 'http';
    throw new EsSparseError(`ES search failed: ${msg}`, kind);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EsSparseError(`ES search HTTP ${res.status}: ${body.slice(0, 200)}`, 'http');
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new EsSparseError('ES search invalid JSON', 'parse');
  }
  const hits = (data as { hits?: { hits?: unknown[] } })?.hits?.hits;
  if (!Array.isArray(hits)) {
    throw new EsSparseError('ES search missing hits.hits', 'parse');
  }
  const out: string[] = [];
  for (const h of hits) {
    if (!h || typeof h !== 'object') continue;
    const row = h as { _id?: unknown; _source?: { chunkId?: unknown } };
    const id =
      typeof row._source?.chunkId === 'string' && row._source.chunkId
        ? row._source.chunkId
        : typeof row._id === 'string'
          ? row._id
          : null;
    if (id) out.push(id);
  }
  return out;
}

/** bulk 索引文档；每项 _id=chunkId */
export async function bulkIndexSparse(
  cfg: EsSparseConfig,
  docs: Array<{ chunkId: string; kbId: string; docId: string; sparseText: string }>,
): Promise<{ indexed: number }> {
  if (docs.length === 0) return { indexed: 0 };
  const base = trimUrl(cfg.baseUrl);
  const timeoutMs = cfg.timeoutMs ?? 30_000;
  const lines: string[] = [];
  for (const d of docs) {
    lines.push(JSON.stringify({ index: { _index: cfg.index, _id: d.chunkId } }));
    lines.push(
      JSON.stringify({
        chunkId: d.chunkId,
        kbId: d.kbId,
        docId: d.docId,
        sparseText: d.sparseText,
      }),
    );
  }
  const res = await fetch(`${base}/_bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-ndjson' },
    signal: AbortSignal.timeout(timeoutMs),
    body: `${lines.join('\n')}\n`,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EsSparseError(`ES bulk HTTP ${res.status}: ${body.slice(0, 200)}`, 'http');
  }
  const data = (await res.json()) as { errors?: boolean; items?: unknown[] };
  if (data.errors) {
    throw new EsSparseError('ES bulk reported errors', 'http');
  }
  return { indexed: docs.length };
}

export function esConfigFromEnv(env: {
  ELASTICSEARCH_URL: string;
  ELASTIC_INDEX?: string;
}): EsSparseConfig | null {
  const baseUrl = (env.ELASTICSEARCH_URL ?? '').trim();
  if (!baseUrl) return null;
  return {
    baseUrl,
    index: (env.ELASTIC_INDEX ?? 'strict_rag_dev').trim() || 'strict_rag_dev',
  };
}
