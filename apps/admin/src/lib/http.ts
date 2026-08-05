'use client';

/**
 * 统一 HTTP：Bearer + 401/UNAUTHORIZED 单飞 refresh + 重试。
 */

import type { ApiResponse, TokenPairResponse } from '@strict-rag/contracts';

import {
  clearClientSession,
  readClientSession,
  saveClientRefreshSession,
} from '@/auth/client-session';
import { getAdminClientEnv } from '@/env.client';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiHttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly shouldRefresh: boolean,
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

let refreshPromise: Promise<void> | null = null;

function resolveBaseURL() {
  return getAdminClientEnv().NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '');
}

function shouldTryRefresh(path: string, payload: ApiResponse<unknown>) {
  if (path.includes('/auth/admin/token/refresh')) return false;
  return !payload.ok && payload.error.code === 'UNAUTHORIZED';
}

async function refreshClientSession() {
  const stored = readClientSession();
  if (!stored) throw new Error('no session');

  const res = await fetch(`${resolveBaseURL()}/api/v1/auth/admin/token/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: stored.refreshToken }),
  });
  const payload = (await res.json()) as ApiResponse<TokenPairResponse>;
  if (!payload.ok) {
    throw new Error(payload.error.message);
  }
  saveClientRefreshSession(payload.data);
}

async function ensureRefresh() {
  if (!refreshPromise) {
    refreshPromise = refreshClientSession().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function requestOnce<T>(
  path: string,
  init: RequestInit & { method?: HttpMethod },
): Promise<ApiResponse<T>> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body && !(init.body instanceof FormData)) {
    headers.set('content-type', 'application/json');
  }
  if (!headers.has('authorization')) {
    const session = readClientSession();
    if (session) {
      headers.set('authorization', `Bearer ${session.accessToken}`);
    }
  }

  const res = await fetch(`${resolveBaseURL()}${path}`, {
    ...init,
    headers,
  });
  return (await res.json()) as ApiResponse<T>;
}

async function request<T>(
  path: string,
  init: RequestInit & { method?: HttpMethod } = {},
): Promise<T> {
  const payload = await requestOnce<T>(path, init);
  if (payload.ok) return payload.data;

  if (shouldTryRefresh(path, payload) && typeof window !== 'undefined') {
    try {
      await ensureRefresh();
      const retry = await requestOnce<T>(path, init);
      if (retry.ok) return retry.data;
      throw new ApiHttpError(retry.error.code, retry.error.message, false);
    } catch {
      clearClientSession();
      throw new ApiHttpError('UNAUTHORIZED', 'session refresh failed', false);
    }
  }

  throw new ApiHttpError(
    payload.error.code,
    payload.error.message,
    shouldTryRefresh(path, payload),
  );
}

export const http = {
  get<T>(path: string) {
    return request<T>(path, { method: 'GET' });
  },
  post<TResponse, TBody = unknown>(path: string, body?: TBody) {
    return request<TResponse>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  patch<TResponse, TBody = unknown>(path: string, body?: TBody) {
    return request<TResponse>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  delete<T>(path: string) {
    return request<T>(path, { method: 'DELETE' });
  },
};
