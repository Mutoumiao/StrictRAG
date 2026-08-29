'use client';

import type {
  CreateEvalRunBody,
  CreateEvalRunResponse,
  CreateGoldQuestionBody,
  EvalRun,
  EvalRunListResponse,
  GoldQuestion,
  GoldQuestionListResponse,
  PatchGoldQuestionBody,
} from '@strict-rag/contracts';

import { http } from '@/lib/http';

export function listGoldQuestions(kbId: string) {
  return http.get<GoldQuestionListResponse>(
    `/api/v1/knowledge-bases/${kbId}/gold-questions`,
  );
}

export function createGoldQuestion(kbId: string, body: CreateGoldQuestionBody) {
  return http.post<GoldQuestion, CreateGoldQuestionBody>(
    `/api/v1/knowledge-bases/${kbId}/gold-questions`,
    body,
  );
}

export function patchGoldQuestion(kbId: string, id: string, body: PatchGoldQuestionBody) {
  return http.patch<GoldQuestion, PatchGoldQuestionBody>(
    `/api/v1/knowledge-bases/${kbId}/gold-questions/${id}`,
    body,
  );
}

export function deleteGoldQuestion(kbId: string, id: string) {
  return http.delete<{ deleted: boolean }>(
    `/api/v1/knowledge-bases/${kbId}/gold-questions/${id}`,
  );
}

export function enqueueEvalRun(kbId: string, body: CreateEvalRunBody = {}) {
  return http.post<CreateEvalRunResponse, CreateEvalRunBody>(
    `/api/v1/knowledge-bases/${kbId}/eval/runs`,
    body,
  );
}

export function listEvalRuns(kbId: string) {
  return http.get<EvalRunListResponse>(`/api/v1/knowledge-bases/${kbId}/eval/runs`);
}

export function getEvalRun(kbId: string, runId: string) {
  return http.get<EvalRun>(`/api/v1/knowledge-bases/${kbId}/eval/runs/${runId}`);
}
