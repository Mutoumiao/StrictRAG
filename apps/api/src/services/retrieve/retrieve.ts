import type { AskReason } from '@strict-rag/contracts';

import {
  GatewayError,
  mapGatewayFailureToAskReason,
  type GatewayClient,
} from '../gateway/index.js';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { recordRerank } from '../../obs/metrics.js';
import { loadCorpusFromDb } from './corpus.js';
import { isDeptAclEnforced } from './dept-acl.js';
import { EsSparseError, esConfigFromEnv, searchSparseEs } from './es-sparse.js';
import { rrfFuse } from './rrf.js';
import { cosine, rankByScore, sparseOverlapScore } from './scoring.js';
import type {
  CorpusChunk,
  EvidenceCandidate,
  RetrieveDeps,
  RetrieveInput,
  RetrieveResult,
} from './types.js';

/** PRD 默认；仅服务端 */
export const DEFAULT_RRF_K = 60;
export const DEFAULT_RETRIEVE_K = 150;
export const DEFAULT_RERANK_TOP_N = 20;

/**
 * RRF 后、rerank 前：闸内 preferred doc 的 chunk 提前或补入，再截断 retrieveK。
 * 无 preferred / 闸外 id → 原 fused。不是独占过滤，不扩 ACL。
 */
export function promotePreferredDocChunks(
  fused: { id: string; score: number }[],
  corpus: CorpusChunk[],
  preferredDocIds: readonly string[] | undefined,
  retrieveK: number,
): { id: string; score: number }[] {
  if (!preferredDocIds?.length) return fused.slice(0, retrieveK);

  const preferred = new Set(preferredDocIds);
  const byId = new Map(corpus.map((c) => [c.chunkId, c]));
  const fusedIds = new Set(fused.map((f) => f.id));
  const inFused: { id: string; score: number }[] = [];
  const rest: { id: string; score: number }[] = [];
  for (const f of fused) {
    const docId = byId.get(f.id)?.docId;
    if (docId && preferred.has(docId)) inFused.push(f);
    else rest.push(f);
  }
  const extras = corpus
    .filter((c) => preferred.has(c.docId) && !fusedIds.has(c.chunkId))
    .map((c) => ({ id: c.chunkId, score: 0 }));
  return [...inFused, ...extras, ...rest].slice(0, retrieveK);
}

function fail(reason: AskReason, message?: string): RetrieveResult {
  return { ok: false, reason, message };
}

/**
 * 混合检索主入口（可注入 deps，单测不连库）。
 * 顺序：成员位 → 空库 → dense∥sparse → RRF → preferred 提权 → Gateway rerank。
 * 禁止 RRF-only answered。
 */
export async function runRetrieve(
  input: RetrieveInput,
  deps: RetrieveDeps,
): Promise<RetrieveResult> {
  if (input.membership === 'none') {
    return fail('not_member', 'retrieve depth: not a kb member');
  }

  // super_admin 绕过部门滤（P3b-SA）；双闸仍在 corpus
  const bypassDeptAcl = input.membership === 'super_admin';
  if (bypassDeptAcl && isDeptAclEnforced()) {
    logger.info(
      { event: 'dept_acl_bypass', userId: input.userId, kbId: input.kbId },
      'dept acl bypass',
    );
  }
  const corpus = await deps.loadCorpus({
    kbId: input.kbId,
    scope: input.scope,
    userId: input.userId,
    bypassDeptAcl,
  });
  if (corpus.length === 0) {
    return fail('kb_not_ready', 'no ready∧active documents in kb');
  }

  // http 无 sparseSearch → loud fail（禁止回落 mock 冒充 live）
  if (deps.esMode === 'http' && !deps.sparseSearch) {
    return fail(
      'internal_guard',
      'RETRIEVE_ES_MODE=http requires sparseSearch (set ELASTICSEARCH_URL; see docs/ops/live-retrieve-profile.md)',
    );
  }

  const retrieveK = input.retrieveK ?? DEFAULT_RETRIEVE_K;
  const rerankTopN = input.rerankTopN ?? DEFAULT_RERANK_TOP_N;
  const byId = new Map(corpus.map((c) => [c.chunkId, c]));

  // --- dense ---
  let denseRanked: string[] = [];
  try {
    const [qVec] = await deps.embed([input.question]);
    if (!qVec) {
      return fail('low_retrieval', 'embed returned empty');
    }
    const denseScored = corpus
      .filter((c) => c.embedding && c.embedding.length > 0)
      .map((c) => ({
        id: c.chunkId,
        score: cosine(qVec, c.embedding!),
      }));
    denseRanked = rankByScore(denseScored).slice(0, retrieveK);
  } catch (err) {
    if (err instanceof GatewayError) {
      return fail(mapGatewayFailureToAskReason(err, 'embed'), err.message);
    }
    throw err;
  }

  // --- sparse：mock=进程内 token 重叠；http=ES BM25（OPS-1 切片）---
  let sparseRanked: string[];
  if (deps.esMode === 'http') {
    try {
      sparseRanked = await deps.sparseSearch!({
        kbId: input.kbId,
        question: input.question,
        size: retrieveK,
      });
      // 仅保留语料内 id（ACL/闸门以 PG corpus 为准）
      sparseRanked = sparseRanked.filter((id) => byId.has(id)).slice(0, retrieveK);
    } catch (err) {
      // ponytail: any sparse failure is loud guard — never fall back to mock token overlap
      const kind = err instanceof EsSparseError ? err.kind : 'error';
      const msg = err instanceof Error ? err.message : String(err);
      return fail('internal_guard', `ES sparse failed (${kind}): ${msg}`);
    }
  } else {
    const sparseScored = corpus
      .filter((c) => c.text.length > 0)
      .map((c) => ({
        id: c.chunkId,
        score: sparseOverlapScore(input.question, c.text),
      }));
    sparseRanked = rankByScore(sparseScored).slice(0, retrieveK);
  }

  if (denseRanked.length === 0 && sparseRanked.length === 0) {
    return fail('low_retrieval', 'no hybrid candidates');
  }

  const fused = promotePreferredDocChunks(
    rrfFuse([denseRanked, sparseRanked], DEFAULT_RRF_K),
    corpus,
    input.preferredDocIds,
    retrieveK,
  );
  if (fused.length === 0) {
    return fail('low_retrieval', 'rrf empty');
  }
  const preferredSet = input.preferredDocIds?.length
    ? new Set(input.preferredDocIds)
    : undefined;
  const preferredAdopted = Boolean(
    preferredSet && corpus.some((c) => preferredSet.has(c.docId)),
  );

  const candidates = fused
    .map((f) => {
      const c = byId.get(f.id);
      if (!c) return null;
      return { chunk: c, rrf: f };
    })
    .filter((x): x is { chunk: CorpusChunk; rrf: (typeof fused)[0] } => x != null);

  const passages = candidates.map((c) => c.chunk.text);
  let rerankHits: { index: number; score: number }[];
  try {
    rerankHits = await deps.rerank(input.question, passages, Math.min(rerankTopN, passages.length));
    recordRerank(true);
  } catch (err) {
    recordRerank(false, err instanceof GatewayError ? err.kind : 'error');
    if (err instanceof GatewayError) {
      return fail(mapGatewayFailureToAskReason(err, 'rerank'), err.message);
    }
    throw err;
  }

  if (rerankHits.length === 0) {
    recordRerank(false, 'empty');
    return fail('low_retrieval', 'rerank returned empty');
  }

  const denseRankOf = new Map(denseRanked.map((id, i) => [id, i + 1]));
  const sparseRankOf = new Map(sparseRanked.map((id, i) => [id, i + 1]));

  const rrfRankOf = new Map(fused.map((f, i) => [f.id, i + 1]));
  const evidence: EvidenceCandidate[] = [];
  for (let ri = 0; ri < rerankHits.length; ri++) {
    const hit = rerankHits[ri]!;
    const cand = candidates[hit.index];
    if (!cand) continue;
    const { chunk } = cand;
    evidence.push({
      chunkId: chunk.chunkId,
      docId: chunk.docId,
      title: chunk.title,
      text: chunk.text,
      preview: chunk.preview ?? chunk.text.slice(0, 200),
      lifecycle: chunk.lifecycle,
      score: hit.score,
      ranks: {
        dense: denseRankOf.get(chunk.chunkId),
        sparse: sparseRankOf.get(chunk.chunkId),
        rrf: rrfRankOf.get(chunk.chunkId),
        rerank: ri + 1,
      },
    });
  }

  if (evidence.length === 0) {
    return fail('low_retrieval', 'no evidence after rerank map');
  }

  return {
    ok: true,
    evidence,
    meta: {
      esMode: deps.esMode,
      candidateCount: candidates.length,
      denseHits: denseRanked.length,
      sparseHits: sparseRanked.length,
      preferredAdopted,
    },
  };
}

/** 生产默认 deps：PG corpus + Gateway；http 时注入 ES sparse */
export function createDefaultRetrieveDeps(gateway: GatewayClient): RetrieveDeps {
  const esMode = env.RETRIEVE_ES_MODE;
  const esCfg = esMode === 'http' ? esConfigFromEnv(env) : null;
  return {
    loadCorpus: loadCorpusFromDb,
    embed: (texts) => gateway.embed(texts),
    rerank: (query, passages, topN) => gateway.rerank(query, passages, topN),
    esMode,
    sparseSearch:
      esMode === 'http' && esCfg
        ? (input) => searchSparseEs(esCfg, input)
        : undefined,
  };
}

/** 便捷：env + gateway 单例路径 */
export async function retrieve(
  input: RetrieveInput,
  gateway: GatewayClient,
): Promise<RetrieveResult> {
  return runRetrieve(input, createDefaultRetrieveDeps(gateway));
}
