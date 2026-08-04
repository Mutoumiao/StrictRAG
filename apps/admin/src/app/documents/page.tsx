'use client';

/**
 * 管理端文档状态薄列表（P1 soft 出口）。
 * 外层 layout 已套 AdminAuthGuard（登录 + admin.shell）。
 */
import { useAdminAuth } from '@/components/auth-guard';
import { adminLogoutLocal } from '@/auth/api';
import { getAdminClientEnv } from '@/env.client';

const apiBase = getAdminClientEnv().NEXT_PUBLIC_API_BASE_URL;

export default function DocumentsThinPage() {
  const { me } = useAdminAuth();

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem' }}>文档状态（薄列表）</h1>
        <button
          type="button"
          onClick={() => {
            adminLogoutLocal();
            window.location.href = '/login';
          }}
          style={{ fontSize: '0.875rem' }}
        >
          退出
        </button>
      </div>
      <p style={{ color: '#64748b' }}>
        已登录：{me.email ?? me.userId} · 角色 {me.roles.join(', ')} · 权限码{' '}
        {me.permissions.length} 个
      </p>
      <p style={{ color: '#64748b' }}>
        Phase 1 soft 出口：请用 API 查询{' '}
        <code>
          GET {apiBase}/api/v1/knowledge-bases/:kbId/documents
        </code>
        。完整运营台属 S2c。
      </p>
      <ul style={{ lineHeight: 1.8 }}>
        <li>status：索引管线（uploaded…ready / failed / needs_ocr）</li>
        <li>approvalStatus：none / pending / approved / rejected</li>
        <li>lifecycle：draft / active / superseded / archived</li>
        <li>鉴权：Bearer + refresh；API 默认 AUTH_ENFORCE=false，true 时强制权限码</li>
      </ul>
    </main>
  );
}
