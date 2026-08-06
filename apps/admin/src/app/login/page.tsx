'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';
import { Select } from '@strict-rag/ui/components/ui/select';

import { loginWithDev } from '@/auth/services';

type RoleTpl = 'super_admin' | 'kb_admin' | 'doc_operator';

/** 开发登录；可选角色模板便于验码裁剪（doc_operator 无审批决定）。 */
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [role, setRole] = useState<RoleTpl>('super_admin');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await loginWithDev({ email, roleTemplate: role });
    if (result.ok) {
      router.replace('/documents');
    } else {
      setError(result.message);
    }
    setPending(false);
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
        <div className="space-y-1.5">
          <Label htmlFor="admin-email">邮箱</Label>
          <Input
            id="admin-email"
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-role">角色模板</Label>
          <Select
            id="admin-role"
            value={role}
            onChange={(ev) => setRole(ev.target.value as RoleTpl)}
          >
            <option value="super_admin">super_admin（全权）</option>
            <option value="kb_admin">kb_admin（含审批/成员）</option>
            <option value="doc_operator">doc_operator（无审批决定）</option>
          </Select>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? '登录中…' : '开发登录'}
        </Button>
      </form>
    </main>
  );
}
