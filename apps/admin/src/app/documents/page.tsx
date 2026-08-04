/**
 * 管理端文档状态薄列表（P1 soft 出口）。
 * 读取 NEXT_PUBLIC_API_BASE_URL；无鉴权演示。
 */
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000';

export default function DocumentsThinPage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.25rem' }}>文档状态（薄列表）</h1>
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
      </ul>
    </main>
  );
}
