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
  tenantId: string;
  kbId: string;
  question: string;
  size: number;
  /** enforce 开且非超管时传入；空/缺省不加部门 terms */
  ownerDeptIds?: string[];
  /** 非超管名单闸；缺省不加 principals clause。不跟 DEPT_ACL_ENFORCE。 */
  applyAclPrincipals?: boolean;
  /** apply 时写入 term；空则只 must_not exists */
  aclPrincipalUserId?: string;
};

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
 * 剧本 O4：`tenantId` 是 builder 的**运行时**硬约束，不靠 TS 类型。
 * 缺 / 空 / 纯空白 → 构查询或构 bulk **即失败**；禁止静默少过滤、禁止回退全租户、禁止补默认租户。
 * 独立索引布局（B8）同样受此约束——'filter 即使独立也强制'（ADR-041）。
 */
function requireTenantId(tenantId: string | undefined | null, where: string): string {
  const t = typeof tenantId === 'string' ? tenantId.trim() : '';
  if (!t) {
    throw new EsSparseError(`missing tenantId in ${where}; 禁止无租户过滤的 ES 查询/写入`, 'config');
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

export type EsAclPrincipalsShould =
  | { bool: { must_not: { exists: { field: 'aclPrincipals' } } } }
  | { term: { aclPrincipals: string } };

export type EsAclPrincipalsClause = {
  bool: {
    should: EsAclPrincipalsShould[];
    minimum_should_match: 1;
  };
};

export type EsAclFilterClause =
  | { term: { tenantId: string } }
  | { term: { kbId: string } }
  | { terms: { ownerDeptId: string[] } }
  | EsAclPrincipalsClause;

/** 有值才写入 ownerDeptId。aclPrincipals：null 不写；[] 写哨兵；非空写 uuid 列表。 */
export function sparseBulkSource(d: SparseBulkDoc): Record<string, string | string[]> {
  const source: Record<string, string | string[]> = {
    chunkId: d.chunkId,
    tenantId: requireTenantId(d.tenantId, 'sparseBulkSource'),
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

/** 未设（缺字段）可读；名单含 userId 可读；[] 与未命中不可读。 */
export function aclPrincipalsFilterClause(userId?: string): EsAclPrincipalsClause {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  const should: EsAclPrincipalsShould[] = [
    { bool: { must_not: { exists: { field: 'aclPrincipals' } } } },
  ];
  if (uid) {
    should.push({ term: { aclPrincipals: uid } });
  }
  return { bool: { should, minimum_should_match: 1 } };
}

/**
 * 检索期 ACL 对称 filter（ES 查询共用，禁止两路各写）。
 * P2 在 ES 查询期强制 tenantId + kbId（共享索引安全隔离，不得事后交 PG）。
 * 非空 ownerDeptIds 时追加 terms 收窄；空/缺省不加部门 terms。
 * applyAclPrincipals 时追加名单 should（缺字段可读；[] 不可命中）。
 * 缺 ownerDeptId / 缺 aclPrincipals 字段不得把「显式空」当成全员可见。
 * 精确可见级仍由 PG filterDocsForDeptAcl / filterDocsForAclPrincipals 把关。
 * status/lifecycle/indexVersion 闸门由 PG corpus（loadCorpusFromDb）对称承载；
 * 生产级 ES 索引字段与 IK/Router 属 B8 分层，不在本窗。
 */
export function buildAclFilter(input: {
  tenantId: string;
  kbId: string;
  ownerDeptIds?: string[];
  applyAclPrincipals?: boolean;
  aclPrincipalUserId?: string;
}): EsAclFilterClause[] {
  const filter: EsAclFilterClause[] = [
    { term: { tenantId: requireTenantId(input.tenantId, 'buildAclFilter') } },
    { term: { kbId: input.kbId } },
  ];
  const ownerDeptIds = (input.ownerDeptIds ?? []).filter((id) => id.trim().length > 0);
  if (ownerDeptIds.length > 0) {
    filter.push({ terms: { ownerDeptId: ownerDeptIds } });
  }
  if (input.applyAclPrincipals) {
    filter.push(aclPrincipalsFilterClause(input.aclPrincipalUserId));
  }
  return filter;
}

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
  if (head.ok) {
    await putSparseAclMapping(cfg, base, timeoutMs);
    return;
  }
  if (head.status !== 404) {
    throw new EsSparseError(`ES HEAD index failed: ${head.status}`, 'http');
  }
  const put = await fetch(`${base}/${encodeURIComponent(index)}`, {
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
    throw new EsSparseError(`ES create index failed: ${put.status} ${body.slice(0, 200)}`, 'http');
  }
}

/** 已有索引补 keyword，避免 dynamic 把 uuid 映成 text 导致 term 静默不命中。 */
async function putSparseAclMapping(
  cfg: EsSparseConfig,
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
    throw new EsSparseError(`ES put mapping failed: ${put.status} ${body.slice(0, 200)}`, 'http');
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
            filter: buildAclFilter(input),
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

/** bulk 索引文档；每项 _id=chunkId。ownerDeptId 有值才写入；aclPrincipals 数组（含空）才写入。 */
export async function bulkIndexSparse(
  cfg: EsSparseConfig,
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
