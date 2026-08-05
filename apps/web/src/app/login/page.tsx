'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { webDevLogin } from '@/auth/api';

/** 开发登录；生产切 Better Auth。 */
export default function WebLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('user@example.com');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await webDevLogin({ email, roleTemplate: 'web_consumer' });
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setPending(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 420,
        margin: '0 auto',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 24,
        padding: 24,
        fontFamily: 'system-ui, sans-serif',
        color: 'var(--sr-foreground)',
        background: 'var(--sr-background)',
      }}
    >
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>StrictRAG</h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--sr-muted)' }}>
          用户端开发登录。问答结果以服务端校验为准；证据不足时会明确拒答。
        </p>
      </div>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 14 }}>
          邮箱
          <input
            style={{
              display: 'block',
              width: '100%',
              marginTop: 4,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--sr-border)',
              fontSize: 14,
            }}
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </label>
        {error ? (
          <p style={{ margin: 0, fontSize: 13, color: '#b91c1c' }}>{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--sr-foreground)',
            color: '#fff',
            fontSize: 14,
            cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? '登录中…' : '开发登录'}
        </button>
      </form>
    </main>
  );
}
