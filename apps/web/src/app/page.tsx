'use client';

import { WebAuthGuard } from '@/components/auth-guard';
import { AskPanel } from '@/components/ask-panel';

/**
 * 用户端最小问答页（S2-10）。
 * 登录后：选 KB（手填 id）→ 提问 → answered/abstained/错误三态。
 */
export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--sr-background)',
        color: 'var(--sr-foreground)',
      }}
    >
      <WebAuthGuard>
        <AskPanel />
      </WebAuthGuard>
    </main>
  );
}
