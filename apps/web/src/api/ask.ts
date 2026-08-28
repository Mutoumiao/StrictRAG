'use client';

/**
 * ask 流传输：DefaultChatTransport + 业务 body。
 * 不自解析 SSE 帧；协议由 AI SDK 消费。
 */

import {
  AskModesSchema,
  type AskAuditResponse,
  type AskMode,
  type AskModes,
  type AskRequest,
  type AskResponse,
  type AskSseStatus,
} from '@strict-rag/contracts';
import { DefaultChatTransport } from 'ai';

import { ApiHttpError, http } from '@/lib/http';

import {
  clearClientSession,
  readClientSession,
  saveClientRefreshSession,
} from '@/auth/client-session';
import { getWebClientEnv } from '@/env.client';

export type AskDataParts = {
  status: AskSseStatus;
  'ask-final': AskResponse;
};

export type AskTransportOptions = {
  kbId: string;
  /** 每次发送时读取 sessionId（可为 null = 单轮） */
  getSessionId: () => string | null;
  getScope?: () => AskRequest['scope'];
  getMode?: () => AskMode | undefined;
};

/**
 * 解析用户输入的文档类型多值（逗号 / 中文逗号）。
 * 空 → undefined（不收窄）；非空 → 去空白、去重后的 docTypes。
 */
export function parseScopeDocTypesInput(raw: string): string[] | undefined {
  const parts = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) return undefined;
  return [...new Set(parts)];
}

/** 装配 ask 请求 body（顶层 scope；禁塞 options）— 供 transport 与单测共用 */
export function buildAskRequestBody(input: {
  question: string;
  sessionId: string | null;
  scope?: AskRequest['scope'];
  mode?: AskMode;
}): AskRequest {
  const body: AskRequest = {
    question: input.question,
    sessionId: input.sessionId,
    options: { stream: true },
  };
  if (input.mode) {
    body.options = { ...body.options, mode: input.mode };
  }
  const docTypes = input.scope?.docTypes?.filter((t) => t.trim().length > 0);
  if (docTypes && docTypes.length > 0) {
    body.scope = { docTypes };
  }
  return body;
}

/** GET /ask/:requestId 当时 evidence 快照；非断线重拉、非现网分片全文 */
export async function getAskAudit(requestId: string) {
  return http.get<AskAuditResponse>(`/api/v1/ask/${encodeURIComponent(requestId)}`);
}

/** GET /knowledge-bases/:kbId/ask-modes 成员档位；不含 τ */
export async function getAskModes(kbId: string) {
  const data = await http.get<AskModes>(
    `/api/v1/knowledge-bases/${encodeURIComponent(kbId)}/ask-modes`,
  );
  return AskModesSchema.parse(data);
}

function isFailEnvelope(
  payload: unknown,
): payload is { ok: false; error: { code: string; message: string } } {
  if (!payload || typeof payload !== 'object' || !('ok' in payload) || !('error' in payload)) {
    return false;
  }
  if ((payload as { ok: unknown }).ok !== false) return false;
  const error = (payload as { error: unknown }).error;
  if (!error || typeof error !== 'object' || !('code' in error) || !('message' in error)) {
    return false;
  }
  return typeof (error as { code: unknown }).code === 'string' &&
    typeof (error as { message: unknown }).message === 'string';
}

/** 非 2xx 且为业务失败信封时抛 ApiHttpError（含 429 RATE_LIMITED） */
export async function throwIfAskFailResponse(res: Response): Promise<void> {
  if (res.ok) return;
  const payload: unknown = await res.clone().json().catch(() => null);
  if (!isFailEnvelope(payload)) return;
  throw new ApiHttpError(payload.error.code, payload.error.message, res.status);
}

function baseURL() {
  return getWebClientEnv().NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '');
}

async function refreshAccessToken(): Promise<boolean> {
  const stored = readClientSession();
  if (!stored) return false;
  const res = await fetch(`${baseURL()}/api/v1/auth/web/token/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: stored.refreshToken }),
  });
  if (!res.ok) {
    clearClientSession();
    return false;
  }
  const payload = (await res.json()) as {
    ok: boolean;
    data?: Parameters<typeof saveClientRefreshSession>[0];
  };
  if (!payload.ok || !payload.data) {
    clearClientSession();
    return false;
  }
  saveClientRefreshSession(payload.data);
  return true;
}

function authHeaders(): Record<string, string> {
  const session = readClientSession();
  return session ? { authorization: `Bearer ${session.accessToken}` } : {};
}

/**
 * 构造指向 ask 的 AI SDK 传输层。
 * body 固定为 AskRequest（options.stream=true）；路径含 kbId。
 */
export function createAskTransport(opts: AskTransportOptions) {
  const api = `${baseURL()}/api/v1/knowledge-bases/${opts.kbId}/ask`;

  return new DefaultChatTransport({
    api,
    headers: () => authHeaders(),
    prepareSendMessagesRequest: ({ messages }) => {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      const question =
        lastUser?.parts
          ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text)
          .join('')
          .trim() ?? '';

      const body = buildAskRequestBody({
        question,
        sessionId: opts.getSessionId(),
        scope: opts.getScope?.(),
        mode: opts.getMode?.(),
      });

      return {
        body,
        headers: authHeaders(),
      };
    },
    fetch: async (input, init) => {
      const first = await fetch(input, init);
      if (first.status === 401) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) return first;
        const headers = new Headers(init?.headers);
        const session = readClientSession();
        if (session) headers.set('authorization', `Bearer ${session.accessToken}`);
        const retry = await fetch(input, { ...init, headers });
        await throwIfAskFailResponse(retry);
        return retry;
      }
      await throwIfAskFailResponse(first);
      return first;
    },
  });
}
