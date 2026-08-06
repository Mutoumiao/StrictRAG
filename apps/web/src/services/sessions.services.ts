'use client';

/**
 * 会话用例：列表 / 新建 / 历史回放。
 * 调 api，不写 path；历史 ≠ citation 证据。
 * 失败一律 Result/message，禁止静默吞错。
 */

import type { SessionMessage, SessionSummary } from '@strict-rag/contracts';

import { createSession, getSessionDetail, listSessions } from '@/api/sessions';
import { mapBizError } from '@/lib/map-biz-error';

export type SessionListResult =
  | { ok: true; sessions: SessionSummary[] }
  | { ok: false; message: string };

export type SessionHistoryResult =
  | { ok: true; messages: SessionMessage[] }
  | { ok: false; message: string };

export type CreateSessionResult =
  | { ok: true; sessionId: string }
  | { ok: false; message: string };

export type RefreshAfterFinalResult = {
  sessionId: string | null;
  history: SessionMessage[];
  sessions: SessionSummary[];
  /** 列表或历史任一失败时有文案；调用方应展示 */
  error?: string;
};

/** 加载会话列表。 */
export async function loadSessionList(kbId: string): Promise<SessionListResult> {
  try {
    const sessions = await listSessions(kbId);
    return { ok: true, sessions };
  } catch (err) {
    return { ok: false, message: mapBizError(err, '加载会话列表失败') };
  }
}

/** 加载会话历史消息（回放，非证据）。 */
export async function loadSessionHistory(
  kbId: string,
  sessionId: string,
): Promise<SessionHistoryResult> {
  try {
    const detail = await getSessionDetail(kbId, sessionId);
    return { ok: true, messages: detail.messages ?? [] };
  } catch (err) {
    return { ok: false, message: mapBizError(err, '加载会话历史失败') };
  }
}

/** 新建会话。 */
export async function createNewSession(kbId: string): Promise<CreateSessionResult> {
  try {
    const row = await createSession(kbId);
    return { ok: true, sessionId: row.sessionId };
  } catch (err) {
    return { ok: false, message: mapBizError(err, '创建会话失败') };
  }
}

/**
 * ask 终态后：刷新历史 + 列表。
 * 部分失败时仍返回已拿到的数据，并带 error 文案。
 */
export async function refreshAfterAskFinal(opts: {
  kbId: string;
  finalSessionId?: string | null;
  activeSessionId: string | null;
}): Promise<RefreshAfterFinalResult> {
  const { kbId, finalSessionId, activeSessionId } = opts;
  const sessionId = finalSessionId ?? activeSessionId;

  if (!kbId) {
    return { sessionId: finalSessionId ?? null, history: [], sessions: [] };
  }

  if (!sessionId) {
    const list = await loadSessionList(kbId);
    if (!list.ok) {
      return {
        sessionId: finalSessionId ?? null,
        history: [],
        sessions: [],
        error: list.message,
      };
    }
    return { sessionId: finalSessionId ?? null, history: [], sessions: list.sessions };
  }

  const [hist, list] = await Promise.all([
    loadSessionHistory(kbId, sessionId),
    loadSessionList(kbId),
  ]);

  const errors: string[] = [];
  if (!hist.ok) errors.push(hist.message);
  if (!list.ok) errors.push(list.message);

  return {
    sessionId,
    history: hist.ok ? hist.messages : [],
    sessions: list.ok ? list.sessions : [],
    error: errors.length > 0 ? errors.join('；') : undefined,
  };
}
