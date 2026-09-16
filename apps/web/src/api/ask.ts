'use client';

/**
 * ask 流传输：DefaultChatTransport + 业务 body。
 * 不自解析 SSE 帧；协议由 AI SDK 消费。
 */

import {
  AskFinalResponseSchema,
  AskModesSchema,
  KbDocTypesSchema,
  type AskAuditResponse,
  type AskFinalResponse,
  type AskMode,
  type AskModes,
  type AskRequest,
  type AskResponse,
  type AskSseStatus,
  type KbDocTypes,
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
  /**
   * 本轮 requestId（随 `x-request-id` 下发，服务端 `requestIdMiddleware` 透传）。
   * 断线后按它重拉终态；**每轮必须换新值**（同 id 两轮会撞 trace）。
   */
  getRequestId?: () => string;
};

/**
 * 每轮请求号。正常浏览器走 `crypto.randomUUID`；缺该 API 的环境退化为「时间戳 + 随机」，
 * 仍是每轮唯一值即可（该值只在审计/重拉链路内做关联，不参与权限判定）。
 */
export function newAskRequestId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `ask-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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

/** GET /ask/:requestId/final 断线重拉终态；`ready=false` 表示该轮终态读不回，不得当 answered */
export async function getAskFinal(requestId: string): Promise<AskFinalResponse> {
  const data = await http.get<AskFinalResponse>(
    `/api/v1/ask/${encodeURIComponent(requestId)}/final`,
  );
  return AskFinalResponseSchema.parse(data);
}

/** GET /knowledge-bases/:kbId/ask-modes 成员档位；不含 τ */
export async function getAskModes(kbId: string) {
  const data = await http.get<AskModes>(
    `/api/v1/knowledge-bases/${encodeURIComponent(kbId)}/ask-modes`,
  );
  return AskModesSchema.parse(data);
}

/** GET /knowledge-bases/:kbId/doc-types 成员类型枚举；不含 τ */
export async function getKbDocTypes(kbId: string) {
  const data = await http.get<KbDocTypes>(
    `/api/v1/knowledge-bases/${encodeURIComponent(kbId)}/doc-types`,
  );
  return KbDocTypesSchema.parse(data);
}

/**
 * 把本轮请求号挂到请求头（纯函数，便于钉契约）。
 * 服务端 `requestIdMiddleware` 认这个头并采用为**本轮** requestId，
 * 断线重拉才可能命中同一轮；缺省不下发。
 */
export function withRequestId(
  headers: Record<string, string>,
  requestId?: string,
): Record<string, string> {
  return requestId ? { ...headers, 'x-request-id': requestId } : headers;
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

  /** 请求头：Bearer + 本轮 requestId（断线重拉的前提） */
  function requestHeaders(): Record<string, string> {
    return withRequestId(authHeaders(), opts.getRequestId?.());
  }

  return new DefaultChatTransport({
    api,
    headers: () => requestHeaders(),
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
        headers: requestHeaders(),
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
