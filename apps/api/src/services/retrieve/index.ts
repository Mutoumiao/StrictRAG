export { rrfFuse } from './rrf.js';
export { cosine, sparseOverlapScore, rankByScore } from './scoring.js';
export { loadCorpusFromDb, hasRetrievableDocs, filterDocsForRetrieve } from './corpus.js';
export {
  collectVisibleOwnerDeptIds,
  filterDocsForDeptAcl,
  isDeptAclEnforced,
  isDocVisibleForDeptAcl,
} from './dept-acl.js';
export { filterDocsForAclPrincipals, isDocVisibleForAclPrincipals } from './doc-acl.js';
export type { AclPrincipalDoc } from './doc-acl.js';
export {
  searchSparseEs,
  ensureSparseIndex,
  bulkIndexSparse,
  buildAclFilter,
  aclPrincipalsFilterClause,
  ACL_PRINCIPALS_NONE_SENTINEL,
  esConfigFromEnv,
  sparseBulkSource,
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
