'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { adminDevLogin } from '@/auth/api';

/** 开发登录页；生产将改为 Better Auth 邮箱/微信等 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await adminDevLogin({ email, roleTemplate: 'super_admin' });
      router.replace('/documents');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">StrictRAG Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          开发期 dev-login（双 token + localStorage）。身份层后续切 Better Auth。
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="text-sm">
          邮箱
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? '登录中…' : '开发登录'}
        </button>
      </form>
    </main>
  );
}
