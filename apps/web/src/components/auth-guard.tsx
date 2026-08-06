'use client';

/**
 * web 壳 Guard：本地会话 + /auth/me。
 * 不要求 admin.shell；成员闸由 ask API 负责。
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthMeResponse, AuthSession } from '@strict-rag/contracts';

import { fetchAuthMe } from '@/auth/api';
import {
  clearClientSession,
  readClientSession,
  sessionChangedEventName,
} from '@/auth/client-session';

type WebAuthContextValue = {
  me: AuthMeResponse;
  session: AuthSession;
  refresh: () => Promise<void>;
};

const WebAuthContext = createContext<WebAuthContextValue | null>(null);

export function WebAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ctx, setCtx] = useState<WebAuthContextValue | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const stored = readClientSession();
    if (!stored) {
      setLoading(false);
      router.replace('/login');
      return;
    }
    try {
      const me = await fetchAuthMe();
      const latest = readClientSession();
      if (!latest) {
        router.replace('/login');
        return;
      }
      setCtx({ me, session: latest.session, refresh: load });
    } catch {
      clearClientSession();
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    function onChange() {
      setLoading(true);
      void load();
    }
    void load();
    window.addEventListener(sessionChangedEventName, onChange);
    return () => window.removeEventListener(sessionChangedEventName, onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [router]);

  if (loading || !ctx) {
    return (
      <div
        style={{
          minHeight: '40vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--sr-muted)',
          fontSize: 14,
        }}
      >
        校验登录状态…
      </div>
    );
  }

  return <WebAuthContext.Provider value={ctx}>{children}</WebAuthContext.Provider>;
}

export function useWebAuth() {
  const v = useContext(WebAuthContext);
  if (!v) throw new Error('useWebAuth must be used within WebAuthGuard');
  return v;
}
