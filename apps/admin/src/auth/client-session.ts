'use client';

/**
 * 参考 ai-partner-agent：localStorage 存 access/refresh/session，
 * 变更发事件供 Guard 同步。
 */

import type { AuthSession, TokenPairResponse } from '@strict-rag/contracts';

const storageKey = 'strict-rag:admin:client-session';
const sessionChangedEventName = 'strict-rag-admin-client-session-changed';

export type StoredAdminSession = {
  accessToken: string;
  refreshToken: string;
  session: AuthSession;
};

let currentSession: StoredAdminSession | null = null;

function canUseStorage() {
  return typeof window !== 'undefined';
}

function notifySessionChanged() {
  if (canUseStorage()) {
    window.dispatchEvent(new Event(sessionChangedEventName));
  }
}

export function readClientSession(): StoredAdminSession | null {
  if (currentSession) return currentSession;
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    currentSession = JSON.parse(raw) as StoredAdminSession;
    return currentSession;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function saveClientSession(
  input: Pick<TokenPairResponse, 'accessToken' | 'refreshToken' | 'session'>,
) {
  currentSession = {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    session: input.session,
  };
  if (canUseStorage()) {
    window.localStorage.setItem(storageKey, JSON.stringify(currentSession));
  }
  notifySessionChanged();
}

export function saveClientRefreshSession(
  input: Pick<TokenPairResponse, 'accessToken' | 'refreshToken' | 'session'>,
) {
  saveClientSession(input);
}

export function clearClientSession() {
  currentSession = null;
  if (canUseStorage()) {
    window.localStorage.removeItem(storageKey);
  }
  notifySessionChanged();
}

export { sessionChangedEventName };
