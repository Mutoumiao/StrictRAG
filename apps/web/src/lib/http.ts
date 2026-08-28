'use client';

/**
 * HTTP 传输层：Bearer、单飞 refresh、重试。
 * 不含业务 API；业务调用见 src/api/* 与 auth/api。
 */

import type { ApiResponse, TokenPairResponse, TokenRefreshRequest } from '@strict-rag/contracts';

import {
  clearClientSession,
  readClientSession,
  saveClientRefreshSession,
} from '@/auth/client-session';
import { getWebClientEnv } from '@/env.client';

export class ApiHttpError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

let refreshPromise: Promise<void> | null = null;

function resolveBaseURL() {
  return getWebClientEnv().NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '');
}

async function refreshClientSession() {
  const stored = readClientSession();
  if (!stored) throw new Error('no session');
  const body: TokenRefreshRequest = { refreshToken: stored.refreshToken };
  const res = await fetch(`${resolveBaseURL()}/api/v1/auth/web/token/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as ApiResponse<TokenPairResponse>;
  if (!payload.ok) throw new Error(payload.error.message);
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
  init: RequestInit = {},
): Promise<{ status: number; payload: ApiResponse<T> }> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }
  if (!headers.has('authorization')) {
    const session = readClientSession();
    if (session) headers.set('authorization', `Bearer ${session.accessToken}`);
  }
  const res = await fetch(`${resolveBaseURL()}${path}`, { ...init, headers });
  return { status: res.status, payload: (await res.json()) as ApiResponse<T> };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { status, payload } = await requestOnce<T>(path, init);
  if (payload.ok) return payload.data;

  if (
    !payload.ok &&
    payload.error.code === 'UNAUTHORIZED' &&
    !path.includes('/auth/web/token/refresh') &&
    typeof window !== 'undefined'
  ) {
    try {
      await ensureRefresh();
      const retry = await requestOnce<T>(path, init);
      if (retry.payload.ok) return retry.payload.data;
      throw new ApiHttpError(retry.payload.error.code, retry.payload.error.message, retry.status);
    } catch (err) {
      if (err instanceof ApiHttpError && err.code !== 'UNAUTHORIZED') throw err;
      clearClientSession();
      throw new ApiHttpError('UNAUTHORIZED', 'session refresh failed', 401);
    }
  }

  throw new ApiHttpError(payload.error.code, payload.error.message, status);
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
};
