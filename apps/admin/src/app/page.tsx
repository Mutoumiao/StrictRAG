import { cn } from '@strict-rag/ui/lib/utils';

/**
 * 管理端空壳首页。菜单/权限 UI 全量不做（catalog 保持种子）。
 */
export default function HomePage() {
  return (
    <main
      className={cn('min-h-screen')}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        background: 'var(--sr-background)',
        color: 'var(--sr-foreground)',
      }}
    >
      <p
        style={{
          fontSize: '0.75rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--sr-muted)',
        }}
      >
        StrictRAG · admin · scaffold
      </p>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 600, margin: 0 }}>管理端空壳</h1>
      <p style={{ color: 'var(--sr-muted)', maxWidth: 420, textAlign: 'center', margin: 0 }}>
        Phase 0 占位页。文档管理 / 审批 / 权限菜单裁剪后续接入。端口 3006。
      </p>
    </main>
  );
}
