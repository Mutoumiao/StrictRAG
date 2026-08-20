/**
 * Worker 真 ES bulk（与 api es-sparse 映射对齐：chunkId/kbId/docId/sparseText）。
 * 无新包；fetch。IK / 多租户 Router 不在本窗。
 */

export type EsHttpConfig = {
  baseUrl: string;
  index: string;
  timeoutMs?: number;
};

export function esHttpConfigFromEnv(env: {
  ELASTICSEARCH_URL: string;
  ELASTIC_INDEX?: string;
}): EsHttpConfig | null {
  const baseUrl = (env.ELASTICSEARCH_URL ?? '').trim();
  if (!baseUrl) return null;
  return {
    baseUrl,
    index: (env.ELASTIC_INDEX ?? 'strict_rag_dev').trim() || 'strict_rag_dev',
  };
}

export function sparseTextForChunk(contextPrefix: string | null, bodyText: string | null): string {
  const prefix = (contextPrefix ?? '').trim();
  const body = (bodyText ?? '').trim();
  if (prefix && body) return `${prefix}\n${body}`;
  return body || prefix;
}

export function reconcileIndexed(
  indexed: string[],
  manifestIds: string[],
): { ok: boolean; missing: string[]; orphan: string[] } {
  const es = new Set(indexed);
  const missing = manifestIds.filter((id) => !es.has(id));
  const orphan = [...es].filter((id) => !manifestIds.includes(id));
  return { ok: missing.length === 0 && orphan.length === 0, missing, orphan };
}

function trimUrl(url: string): string {
  return url.replace(/\/$/, '');
}

export async function ensureSparseIndex(cfg: EsHttpConfig): Promise<void> {
  const base = trimUrl(cfg.baseUrl);
  const timeoutMs = cfg.timeoutMs ?? 10_000;
  const head = await fetch(`${base}/${encodeURIComponent(cfg.index)}`, {
    method: 'HEAD',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (head.ok) return;
  if (head.status !== 404) {
    throw new Error(`ES HEAD index failed: ${head.status}`);
  }
  const put = await fetch(`${base}/${encodeURIComponent(cfg.index)}`, {
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
    throw new Error(`ES create index failed: ${put.status} ${body.slice(0, 200)}`);
  }
}

export async function bulkIndexSparse(
  cfg: EsHttpConfig,
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
    throw new Error(`ES bulk HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { errors?: boolean };
  if (data.errors) {
    throw new Error('ES bulk reported errors');
  }
  return { indexed: docs.length };
}

export async function listIndexedChunkIds(cfg: EsHttpConfig, docId: string): Promise<string[]> {
  const base = trimUrl(cfg.baseUrl);
  const timeoutMs = cfg.timeoutMs ?? 15_000;
  const res = await fetch(`${base}/${encodeURIComponent(cfg.index)}/_search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      size: 10_000,
      query: { term: { docId } },
      _source: ['chunkId'],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ES search HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    hits?: { hits?: Array<{ _id?: unknown; _source?: { chunkId?: unknown } }> };
  };
  const hits = data.hits?.hits;
  if (!Array.isArray(hits)) return [];
  const out: string[] = [];
  for (const h of hits) {
    const id =
      typeof h._source?.chunkId === 'string' && h._source.chunkId
        ? h._source.chunkId
        : typeof h._id === 'string'
          ? h._id
          : null;
    if (id) out.push(id);
  }
  return out;
}
