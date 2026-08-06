'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';

import { loginWithDev } from '@/auth/services';

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
    const result = await loginWithDev({ email, roleTemplate: 'web_consumer' });
    if (result.ok) {
      router.replace('/');
    } else {
      setError(result.message);
    }
    setPending(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="m-0 text-[22px] font-semibold">StrictRAG</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          用户端开发登录。问答结果以服务端校验为准；证据不足时会明确拒答。
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="web-email">邮箱</Label>
          <Input
            id="web-email"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </div>
        {error ? <p className="m-0 text-[13px] text-destructive">{error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? '登录中…' : '开发登录'}
        </Button>
      </form>
    </main>
  );
}
