'use client';

import type { AuthMeResponse, DevLoginRequest, TokenPairResponse } from '@strict-rag/contracts';

import { http } from '@/lib/http';

import { clearClientSession, saveClientSession } from './client-session';

export async function adminDevLogin(input: DevLoginRequest) {
  const data = await http.post<TokenPairResponse, DevLoginRequest>(
    '/api/v1/auth/admin/dev-login',
    input,
  );
  saveClientSession(data);
  return data;
}

export async function fetchAuthMe() {
  return http.get<AuthMeResponse>('/api/v1/auth/me');
}

export function adminLogoutLocal() {
  clearClientSession();
}
