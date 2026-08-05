import type { AskReason } from '@strict-rag/contracts';

import {
  GatewayError,
  mapGatewayFailureToAskReason,
  type GatewayClient,
} from '../gateway/index.js';
import { env } from '../../env.js';
import { recordRerank } from '../../obs/metrics.js';
import { loadCorpusFromDb } from './corpus.js';
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

function fail(reason: AskReason, message?: string): RetrieveResult {
  return { ok: false, reason, message };
}

/**
 * 混合检索主入口（可注入 deps，单测不连库）。
 * 顺序：成员位 → 空库 → dense∥sparse → RRF → Gateway rerank。
 * 禁止 RRF-only answered。
 */
export async function runRetrieve(
  input: RetrieveInput,
  deps: RetrieveDeps,
): Promise<RetrieveResult> {
  if (input.membership === 'none') {
    return fail('not_member', 'retrieve depth: not a kb member');
  }

  // super_admin 与 member 同检索谓词；P2 无 docId terms ACL
  const corpus = await deps.loadCorpus({ kbId: input.kbId, scope: input.scope });
  if (corpus.length === 0) {
    return fail('kb_not_ready', 'no ready∧active documents in kb');
  }

  // http 真 ES 未交付（B8）；禁止 silent 空结果冒充
  if (deps.esMode === 'http') {
    return fail('internal_guard', 'RETRIEVE_ES_MODE=http not implemented (backlog B8)');
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

  // --- sparse (mock：进程内 token 重叠；对齐生产 ES 接口形状) ---
  const sparseScored = corpus
    .filter((c) => c.text.length > 0)
    .map((c) => ({
      id: c.chunkId,
      score: sparseOverlapScore(input.question, c.text),
    }));
  const sparseRanked = rankByScore(sparseScored).slice(0, retrieveK);

  if (denseRanked.length === 0 && sparseRanked.length === 0) {
    return fail('low_retrieval', 'no hybrid candidates');
  }

  const fused = rrfFuse([denseRanked, sparseRanked], DEFAULT_RRF_K).slice(0, retrieveK);
  if (fused.length === 0) {
    return fail('low_retrieval', 'rrf empty');
  }

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
    },
  };
}

/** 生产默认 deps：PG corpus + Gateway */
export function createDefaultRetrieveDeps(gateway: GatewayClient): RetrieveDeps {
  const esMode = env.RETRIEVE_ES_MODE;
  return {
    loadCorpus: loadCorpusFromDb,
    embed: (texts) => gateway.embed(texts),
    rerank: (query, passages, topN) => gateway.rerank(query, passages, topN),
    esMode,
  };
}

/** 便捷：env + gateway 单例路径 */
export async function retrieve(
  input: RetrieveInput,
  gateway: GatewayClient,
): Promise<RetrieveResult> {
  return runRetrieve(input, createDefaultRetrieveDeps(gateway));
}
