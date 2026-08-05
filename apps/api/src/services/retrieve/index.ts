export { rrfFuse } from './rrf.js';
export { cosine, sparseOverlapScore, rankByScore } from './scoring.js';
export { loadCorpusFromDb, hasRetrievableDocs, filterDocsForRetrieve } from './corpus.js';
export {
  runRetrieve,
  retrieve,
  createDefaultRetrieveDeps,
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
} from './types.js';
