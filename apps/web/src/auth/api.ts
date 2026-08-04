'use client';

import type { TokenPairResponse } from '@strict-rag/contracts';

import { http } from '@/lib/http';
import { clearClientSession, saveClientSession } from './client-session';

export async function webDevLogin(input: {
  email: string;
  roleTemplate?: 'web_consumer' | 'super_admin' | 'kb_admin' | 'doc_operator';
  tenantId?: string;
}) {
  const data = await http.post<TokenPairResponse, typeof input>(
    '/api/v1/auth/web/dev-login',
    input,
  );
  saveClientSession(data);
  return data;
}

export async function fetchAuthMe() {
  return http.get<{
    userId: string;
    app: string;
    roles: string[];
    permissions: string[];
    email?: string;
  }>('/api/v1/auth/me');
}

export function webLogoutLocal() {
  clearClientSession();
}
