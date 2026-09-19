/**
 * Worker 真 ES bulk（与 api es-sparse 映射对齐：chunkId/kbId/docId/ownerDeptId/aclPrincipals/sparseText）。
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

export type SparseBulkDoc = {
  chunkId: string;
  tenantId: string;
  kbId: string;
  docId: string;
  sparseText: string;
  ownerDeptId?: string | null;
  /** null/缺省不写字段；[] 写哨兵（ES exists 不认空数组）；非空写 uuid 列表 */
  aclPrincipals?: string[] | null;
};

/** ES exists 不认空数组。显式空写入此哨兵，使字段存在且对真实 userId 无 term 命中。 */
export const ACL_PRINCIPALS_NONE_SENTINEL = '__acl_none__';

/**
 * 剧本 O4：`tenantId` 是 bulk builder 的**运行时**硬约束，不靠 TS 类型。
 * 缺 / 空 / 纯空白 → 构 bulk **即失败**；禁止静默少过滤、禁止补默认租户。
 */
function requireTenantId(tenantId: string | undefined | null): string {
  const t = typeof tenantId === 'string' ? tenantId.trim() : '';
  if (!t) {
    throw new Error('missing tenantId in sparseBulkSource; 禁止无租户过滤的 ES 写入');
  }
  return t;
}

const SPARSE_INDEX_PROPERTIES = {
  chunkId: { type: 'keyword' as const },
  tenantId: { type: 'keyword' as const },
  kbId: { type: 'keyword' as const },
  docId: { type: 'keyword' as const },
  ownerDeptId: { type: 'keyword' as const },
  aclPrincipals: { type: 'keyword' as const },
  sparseText: { type: 'text' as const },
};

/** 有值才写入 ownerDeptId。aclPrincipals：null 不写；[] 写哨兵；非空写 uuid 列表。 */
export function sparseBulkSource(d: SparseBulkDoc): Record<string, string | string[]> {
  const source: Record<string, string | string[]> = {
    chunkId: d.chunkId,
    tenantId: requireTenantId(d.tenantId),
    kbId: d.kbId,
    docId: d.docId,
    sparseText: d.sparseText,
  };
  const owner = typeof d.ownerDeptId === 'string' ? d.ownerDeptId.trim() : '';
  if (owner) source.ownerDeptId = owner;
  if (Array.isArray(d.aclPrincipals)) {
    const ids = d.aclPrincipals.filter((id) => typeof id === 'string' && id.length > 0);
    source.aclPrincipals = ids.length > 0 ? ids : [ACL_PRINCIPALS_NONE_SENTINEL];
  }
  return source;
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

/** 已有索引补 keyword，避免 dynamic 把 uuid 映成 text 导致 term 静默不命中。 */
async function putSparseAclMapping(
  cfg: EsHttpConfig,
  base: string,
  timeoutMs: number,
): Promise<void> {
  const put = await fetch(`${base}/${encodeURIComponent(cfg.index)}/_mapping`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      properties: {
        ownerDeptId: { type: 'keyword' },
        aclPrincipals: { type: 'keyword' },
      },
    }),
  });
  if (!put.ok) {
    const body = await put.text().catch(() => '');
    throw new Error(`ES put mapping failed: ${put.status} ${body.slice(0, 200)}`);
  }
}

export async function ensureSparseIndex(cfg: EsHttpConfig): Promise<void> {
  const base = trimUrl(cfg.baseUrl);
  const timeoutMs = cfg.timeoutMs ?? 10_000;
  const head = await fetch(`${base}/${encodeURIComponent(cfg.index)}`, {
    method: 'HEAD',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (head.ok) {
    await putSparseAclMapping(cfg, base, timeoutMs);
    return;
  }
  if (head.status !== 404) {
    throw new Error(`ES HEAD index failed: ${head.status}`);
  }
  const put = await fetch(`${base}/${encodeURIComponent(cfg.index)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      mappings: {
        properties: SPARSE_INDEX_PROPERTIES,
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
  docs: SparseBulkDoc[],
): Promise<{ indexed: number }> {
  if (docs.length === 0) return { indexed: 0 };
  const base = trimUrl(cfg.baseUrl);
  const timeoutMs = cfg.timeoutMs ?? 30_000;
  const lines: string[] = [];
  for (const d of docs) {
    lines.push(JSON.stringify({ index: { _index: cfg.index, _id: d.chunkId } }));
    lines.push(JSON.stringify(sparseBulkSource(d)));
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
