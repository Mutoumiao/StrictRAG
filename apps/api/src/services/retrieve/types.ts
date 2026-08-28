import type { AskReason } from '@strict-rag/contracts';

/** 成员纵深位（ask 入口应已 403；retrieve 防绕过） */
export type MembershipSlot = 'member' | 'super_admin' | 'none';

export type RetrieveScope = {
  docTypes?: string[];
};

/** 闸后候选语料（dense/sparse 同源） */
export type CorpusChunk = {
  chunkId: string;
  docId: string;
  title?: string;
  /** 检索/rerank 正文 */
  text: string;
  preview?: string;
  lifecycle?: string;
  docType?: string | null;
  embedding?: number[];
};

export type EvidenceCandidate = {
  chunkId: string;
  docId: string;
  title?: string;
  text: string;
  preview?: string;
  lifecycle?: string;
  score: number;
  ranks?: {
    dense?: number;
    sparse?: number;
    rrf?: number;
    rerank?: number;
  };
};

export type RetrieveInput = {
  tenantId: string;
  kbId: string;
  question: string;
  membership: MembershipSlot;
  /** 开 DEPT_ACL_ENFORCE 时算归属；缺省 = 无归属 */
  userId?: string;
  scope?: RetrieveScope;
  /** 服务端默认；禁止客户端透传 */
  retrieveK?: number;
  rerankTopN?: number;
  /** 闸后提权；不扩 ACL / 不独占过滤 */
  preferredDocIds?: readonly string[];
};

export type RetrieveOk = {
  ok: true;
  evidence: EvidenceCandidate[];
  meta: {
    esMode: 'mock' | 'http';
    candidateCount: number;
    denseHits: number;
    sparseHits: number;
    /** 闸后语料里实际命中 ≥1 个 preferred docId */
    preferredAdopted?: boolean;
  };
};

export type RetrieveFail = {
  ok: false;
  reason: AskReason;
  message?: string;
};

export type RetrieveResult = RetrieveOk | RetrieveFail;

/** 可注入：单测不连 PG；生产走 loadCorpusFromDb */
export type CorpusLoader = (input: {
  kbId: string;
  scope?: RetrieveScope;
  userId?: string;
  /** P3b-SA：超管绕过部门滤；缺省 false */
  bypassDeptAcl?: boolean;
}) => Promise<CorpusChunk[]>;

/** http 模式 sparse：返回有序 chunkId；失败应抛错（禁止静默空） */
export type SparseSearcher = (input: {
  tenantId: string;
  kbId: string;
  question: string;
  size: number;
}) => Promise<string[]>;

/** 融合后批取正文；chunkId → 权威切片（contextPrefix + "\n" + text）。失败应抛错 */
export type ChunkBodyLoader = (chunkIds: readonly string[]) => Promise<Map<string, string>>;

export type RetrieveDeps = {
  loadCorpus: CorpusLoader;
  embed: (texts: string[]) => Promise<number[][]>;
  rerank: (query: string, passages: string[], topN: number) => Promise<{ index: number; score: number }[]>;
  esMode: 'mock' | 'http';
  /**
   * RETRIEVE_ES_MODE=http 必填（生产 createDefaultRetrieveDeps 注入）。
   * 缺省且 esMode=http → internal_guard（禁止回落 mock）。
   */
  sparseSearch?: SparseSearcher;
  /**
   * 融合后批取权威正文（Mongo）。缺省 = 演示回退 PG body_text；
   * 注入后不得再回退 PG（权威分裂禁止）。
   */
  loadBodies?: ChunkBodyLoader;
};
