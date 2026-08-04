'use client';

/**
 * Dashboard 壳 Guard：本地会话 + /auth/me（走 http 无感 refresh）。
 * 细权限仍由 API requirePermission 把关（UI ≠ API）。
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthSession } from '@strict-rag/contracts';

import { fetchAuthMe } from '@/auth/api';
import {
  clearClientSession,
  readClientSession,
  sessionChangedEventName,
} from '@/auth/client-session';

type AuthMe = {
  userId: string;
  sessionId: string;
  app: string;
  roles: string[];
  permissions: string[];
  email?: string;
  tenantId?: string;
};

type AdminAuthContextValue = {
  me: AuthMe;
  session: AuthSession;
  refresh: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ctx, setCtx] = useState<AdminAuthContextValue | null>(null);
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
      if (!me.permissions.includes('admin.shell')) {
        clearClientSession();
        router.replace('/login');
        return;
      }
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
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        校验登录状态…
      </div>
    );
  }

  return <AdminAuthContext.Provider value={ctx}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const v = useContext(AdminAuthContext);
  if (!v) throw new Error('useAdminAuth must be used within AdminAuthGuard');
  return v;
}
