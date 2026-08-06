'use client';

/**
 * 身份 HTTP：仅 path + contracts。
 * 写/清本地会话、错误映射 → auth/services。
 */

import type { AuthMeResponse, DevLoginRequest, TokenPairResponse } from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function webDevLogin(input: DevLoginRequest) {
  return http.post<TokenPairResponse, DevLoginRequest>(
    '/api/v1/auth/web/dev-login',
    input,
  );
}

export async function fetchAuthMe() {
  return http.get<AuthMeResponse>('/api/v1/auth/me');
}
