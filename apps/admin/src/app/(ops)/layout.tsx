import type { ReactNode } from 'react';

import { AdminShell } from '@/components/admin-shell';
import { AdminAuthGuard } from '@/components/auth-guard';

/** 运营页统一：登录壳 + admin.shell + 菜单 */
export default function OpsLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthGuard>
      <AdminShell>{children}</AdminShell>
    </AdminAuthGuard>
  );
}
