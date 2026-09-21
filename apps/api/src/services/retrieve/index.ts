export { rrfFuse } from './rrf.js';
export { cosine, sparseOverlapScore, rankByScore } from './scoring.js';
export { loadCorpusFromDb, filterDocsForRetrieve } from './corpus.js';
export {
  collectVisibleOwnerDeptIds,
  filterDocsForDeptAcl,
  isDeptAclEnforced,
  isDocVisibleForDeptAcl,
} from './dept-acl.js';
export { filterDocsForAclPrincipals, isDocVisibleForAclPrincipals } from './doc-acl.js';
export type { AclPrincipalDoc } from './doc-acl.js';
export { filterVisibleDocs, isDocVisible, loadVisibilityContext } from './visibility.js';
export type {
  VisibilityContext,
  VisibilityDecision,
  VisibilityDoc,
  VisibilitySubject,
} from './visibility.js';
export {
  searchSparseEs,
  ensureSparseIndex,
  bulkIndexSparse,
  buildAclFilter,
  ownerDeptFilterClause,
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
