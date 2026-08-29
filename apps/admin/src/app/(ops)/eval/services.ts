'use client';

import type {
  CreateEvalRunResponse,
  CreateGoldQuestionBody,
  EvalRun,
  GoldQuestion,
} from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import {
  createGoldQuestion,
  deleteGoldQuestion,
  enqueueEvalRun,
  getEvalRun,
  listEvalRuns,
  listGoldQuestions,
} from './api';

export type LoadEvalResult =
  | { ok: true; questions: GoldQuestion[]; runs: EvalRun[] }
  | { ok: false; message: string };

export async function loadEvalBoard(kbId: string): Promise<LoadEvalResult> {
  try {
    const [q, r] = await Promise.all([listGoldQuestions(kbId), listEvalRuns(kbId)]);
    return { ok: true, questions: q.items ?? [], runs: r.items ?? [] };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function addGoldQuestion(
  kbId: string,
  body: CreateGoldQuestionBody,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await createGoldQuestion(kbId, body);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function removeGoldQuestion(
  kbId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await deleteGoldQuestion(kbId, id);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function startEvalRun(
  kbId: string,
): Promise<{ ok: true; queued: CreateEvalRunResponse } | { ok: false; message: string }> {
  try {
    const queued = await enqueueEvalRun(kbId, {});
    return { ok: true, queued };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function loadEvalRunDetail(
  kbId: string,
  runId: string,
): Promise<{ ok: true; run: EvalRun } | { ok: false; message: string }> {
  try {
    const run = await getEvalRun(kbId, runId);
    return { ok: true, run };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
