'use client';

import type { AuthSession, TokenPairResponse } from '@strict-rag/contracts';

const storageKey = 'strict-rag:web:client-session';
const sessionChangedEventName = 'strict-rag-web-client-session-changed';

export type StoredWebSession = {
  accessToken: string;
  refreshToken: string;
  session: AuthSession;
};

let currentSession: StoredWebSession | null = null;

function canUseStorage() {
  return typeof window !== 'undefined';
}

function notifySessionChanged() {
  if (canUseStorage()) {
    window.dispatchEvent(new Event(sessionChangedEventName));
  }
}

export function readClientSession(): StoredWebSession | null {
  if (currentSession) return currentSession;
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    currentSession = JSON.parse(raw) as StoredWebSession;
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
