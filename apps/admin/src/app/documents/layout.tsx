import type { ReactNode } from 'react';

import { AdminAuthGuard } from '@/components/auth-guard';

export default function DocumentsLayout({ children }: { children: ReactNode }) {
  return <AdminAuthGuard>{children}</AdminAuthGuard>;
}
