'use client';

import {
  type ApiResponse,
  type AskRequest,
  type AskResponse,
  type TokenPairResponse,
} from '@strict-rag/contracts';

import {
  clearClientSession,
  readClientSession,
  saveClientRefreshSession,
} from '@/auth/client-session';
import { getWebClientEnv } from '@/env.client';
import {
  parseAskSseText,
  type AskSseError,
  type AskSseStatus,
} from '@/lib/ask-sse-parse';
import { ApiHttpError } from '@/lib/http';

export type { AskSseError, AskSseStatus };
export { parseAskSseText };

export type AskSseResult =
  | { kind: 'final'; response: AskResponse; lastError?: AskSseError }
  | { kind: 'http_error'; code: string; message: string; status: number };

function baseURL() {
  return getWebClientEnv().NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '');
}

async function refreshOnce() {
  const stored = readClientSession();
  if (!stored) throw new ApiHttpError('UNAUTHORIZED', 'no session');
  const res = await fetch(`${baseURL()}/api/v1/auth/web/token/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: stored.refreshToken }),
  });
  const payload = (await res.json()) as ApiResponse<TokenPairResponse>;
  if (!payload.ok) {
    clearClientSession();
    throw new ApiHttpError(payload.error.code, payload.error.message);
  }
  saveClientRefreshSession(payload.data);
}

/**
 * 默认 SSE ask。只消费 final；token 缓冲一律忽略（服务端 P2 也不推）。
 * body 固定 options.stream=true；scope 若有则顶层。
 */
export async function askKnowledgeBase(
  kbId: string,
  input: Omit<AskRequest, 'options'> & { options?: AskRequest['options'] },
  opts?: { signal?: AbortSignal; onStatus?: (s: AskSseStatus) => void },
): Promise<AskSseResult> {
  const body: AskRequest = {
    question: input.question,
    sessionId: input.sessionId,
    scope: input.scope,
    options: {
      stream: true,
      ...(input.options?.debug !== undefined ? { debug: input.options.debug } : {}),
      ...(input.options?.mode !== undefined ? { mode: input.options.mode } : {}),
      ...(input.options?.locale !== undefined ? { locale: input.options.locale } : {}),
    },
  };

  async function once(): Promise<AskSseResult> {
    const session = readClientSession();
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'text/event-stream',
    };
    if (session) headers.authorization = `Bearer ${session.accessToken}`;

    const res = await fetch(`${baseURL()}/api/v1/knowledge-bases/${kbId}/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: opts?.signal,
    });

    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('text/event-stream')) {
      let code = 'INTERNAL';
      let message = `HTTP ${res.status}`;
      try {
        const json = (await res.json()) as ApiResponse<unknown>;
        if (!json.ok) {
          code = json.error.code;
          message = json.error.message;
        }
      } catch {
        /* keep defaults */
      }
      return { kind: 'http_error', code, message, status: res.status };
    }

    const text = await res.text();
    const { final, error, statuses } = parseAskSseText(text);
    for (const s of statuses) opts?.onStatus?.(s);

    if (!final) {
      return {
        kind: 'http_error',
        code: error?.code ?? 'INTERNAL',
        message: error?.message ?? 'SSE 未返回 final',
        status: res.status,
      };
    }
    return { kind: 'final', response: final, lastError: error ?? undefined };
  }

  try {
    const first = await once();
    if (
      first.kind === 'http_error' &&
      (first.code === 'UNAUTHORIZED' || first.status === 401)
    ) {
      await refreshOnce();
      return once();
    }
    return first;
  } catch (err) {
    if (err instanceof ApiHttpError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiHttpError('INTERNAL', err instanceof Error ? err.message : 'ask failed');
  }
}
