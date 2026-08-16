export { rrfFuse } from './rrf.js';
export { cosine, sparseOverlapScore, rankByScore } from './scoring.js';
export { loadCorpusFromDb, hasRetrievableDocs, filterDocsForRetrieve } from './corpus.js';
export {
  filterDocsForDeptAcl,
  isDeptAclEnforced,
  isDocVisibleForDeptAcl,
} from './dept-acl.js';
export {
  searchSparseEs,
  ensureSparseIndex,
  bulkIndexSparse,
  esConfigFromEnv,
  EsSparseError,
} from './es-sparse.js';
export {
  runRetrieve,
  retrieve,
  createDefaultRetrieveDeps,
  promotePreferredDocChunks,
  DEFAULT_RRF_K,
  DEFAULT_RETRIEVE_K,
  DEFAULT_RERANK_TOP_N,
} from './retrieve.js';
export type {
  MembershipSlot,
  RetrieveScope,
  CorpusChunk,
  EvidenceCandidate,
  RetrieveInput,
  RetrieveResult,
  RetrieveOk,
  RetrieveFail,
  CorpusLoader,
  RetrieveDeps,
  SparseSearcher,
} from './types.js';
export type { EsSparseConfig, EsSparseSearchInput } from './es-sparse.js';
