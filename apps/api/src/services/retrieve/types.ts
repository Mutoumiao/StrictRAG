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
  kbId: string;
  question: string;
  membership: MembershipSlot;
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
}) => Promise<CorpusChunk[]>;

/** http 模式 sparse：返回有序 chunkId；失败应抛错（禁止静默空） */
export type SparseSearcher = (input: {
  kbId: string;
  question: string;
  size: number;
}) => Promise<string[]>;

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
};
