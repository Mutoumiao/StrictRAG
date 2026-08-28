'use client';

/**
 * 挂在顶栏 KB 选择器旁的建库入口。有 kb.create 才渲染。
 * 不单开二级菜单；不做策略 / 类型 / 绑定向导。
 */

import { useState, type FormEvent } from 'react';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';

import { createKbAndSelect } from '@/lib/kb-create.services';

type CreatedKb = { id: string; name: string };

export function CreateKbControls({
  defaultAdminUserId,
  onCreated,
}: {
  defaultAdminUserId: string;
  onCreated: (kb: CreatedKb) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [initialAdminUserId, setInitialAdminUserId] = useState(defaultAdminUserId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function openForm() {
    setOpen(true);
    setName('');
    setInitialAdminUserId(defaultAdminUserId);
    setMessage(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const adminId = initialAdminUserId.trim();
    if (!trimmedName || !adminId) return;
    setBusy(true);
    setMessage(null);
    const result = await createKbAndSelect({
      name: trimmedName,
      initialAdminUserId: adminId,
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setOpen(false);
    setName('');
    onCreated({ id: result.kb.id, name: result.kb.name });
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      {open ? (
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card px-2 py-2"
        >
          <div className="space-y-1">
            <Label htmlFor="create-kb-name">名称</Label>
            <Input
              id="create-kb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-8 w-[160px] text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-kb-admin">首位库管</Label>
            <Input
              id="create-kb-admin"
              value={initialAdminUserId}
              onChange={(e) => setInitialAdminUserId(e.target.value)}
              required
              className="h-8 w-[220px] font-mono text-xs"
            />
          </div>
          <Button type="submit" size="sm" disabled={busy}>
            确认创建
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            取消
          </Button>
          {message ? <p className="w-full text-xs text-destructive">{message}</p> : null}
        </form>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={openForm}>
          创建知识库
        </Button>
      )}
    </div>
  );
}
