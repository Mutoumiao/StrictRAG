/**
 * 目标：角色授码必须按菜单树分组（L1 / L2 / 操作码），且任何 catalog 码都不得被静默丢掉。
 * 需求：prds/00-product/05-frontend-ia.md §2.4 · 功能表 §4.1 · prds/09-security 角色树 UI（P2 必达）
 * 被测：buildPermissionTree · RolesWorkspace
 * 简介：分组来自 admin-catalog MENU_TREE；未挂菜单的码落「其他（未挂菜单）」仍可勾；鉴权语义真值在 api。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionCatalogItem, PlatformRole } from '@strict-rag/contracts';

import { render, screen, userEvent } from '@/test/test-utils';

const me = {
  userId: 'u-1',
  email: 'ops@test.local',
  permissions: [] as string[],
};

const loadRolesPage = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/(ops)/roles/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/roles/services')>();
  return {
    ...actual,
    loadRolesPage: (...args: unknown[]) => loadRolesPage(...args),
    createRole: vi.fn(),
    saveRolePermissions: vi.fn(),
  };
});

import { RolesWorkspace } from '@/app/(ops)/roles/_components/roles-workspace';
import {
  buildPermissionTree,
  UNGROUPED_GROUP_ID,
} from '@/app/(ops)/roles/permission-tree';

const catalog: PermissionCatalogItem[] = [
  { code: 'admin.shell', kind: 'page', scope: 'platform', description: '进入 admin 壳' },
  { code: 'doc.view', kind: 'page', scope: 'kb', description: '文档列表与状态' },
  { code: 'doc.upload', kind: 'action', scope: 'kb', description: '上传（进审批）' },
  { code: 'approval.decide', kind: 'action', scope: 'kb', description: '审批决定' },
  { code: 'feedback.queue', kind: 'page', scope: 'kb', description: '反馈队列' },
];

const role: PlatformRole = {
  id: '01900000-0000-7000-8000-0000000000d1',
  code: 'kb_admin',
  name: '知识库管理员',
  isSystem: true,
  enabled: true,
  codes: ['admin.shell', 'doc.view'],
};

/** 树里出现过的码（展平），用于证明无丢码 */
function treeCodes(): string[] {
  return buildPermissionTree(catalog).flatMap((g) => g.items.flatMap((it) => it.codes));
}

describe('buildPermissionTree', () => {
  it('每个 catalog 码都出现且仅出现一次（禁止静默丢码）', () => {
    const codes = treeCodes();
    expect([...codes].sort()).toEqual(catalog.map((c) => c.code).sort());
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('挂在菜单树：顶级按 L1，码落对应 L2（page 与 action 同节点）', () => {
    const tree = buildPermissionTree(catalog);
    expect(tree.map((g) => g.label)).toEqual(['知识库', '其他（未挂菜单）']);

    const kb = tree.find((g) => g.label === '知识库')!;
    const docs = kb.items.find((it) => it.label === '文档')!;
    expect(docs.codes).toEqual(['doc.view', 'doc.upload']);
    const approvals = kb.items.find((it) => it.label === '审批中心')!;
    expect(approvals.codes).toEqual(['approval.decide']);
  });

  it('未挂菜单的码落「其他（未挂菜单）」，不得消失', () => {
    const tree = buildPermissionTree(catalog);
    const rest = tree.find((g) => g.id === UNGROUPED_GROUP_ID)!;
    expect(rest.items.flatMap((it) => it.codes)).toEqual(['admin.shell']);
  });

  it('空 catalog → 空树（不造假节点）', () => {
    expect(buildPermissionTree([])).toEqual([]);
  });
});

describe('RolesWorkspace 树状授码', () => {
  beforeEach(() => {
    me.permissions = ['admin.shell', 'role.perm.manage'];
    loadRolesPage.mockReset();
    loadRolesPage.mockResolvedValue({ ok: true, roles: [role], catalog });
  });

  it('授码面板按 L1 / L2 分组渲染，未挂菜单的码仍可见可勾', async () => {
    render(<RolesWorkspace />);
    await screen.findByText('知识库管理员');
    const buttons = screen.getAllByRole('button', { name: '授码' });
    const user = userEvent.setup();
    await user.click(buttons[0]!);

    expect(await screen.findByText('知识库')).toBeInTheDocument();
    expect(screen.getByText('文档')).toBeInTheDocument();
    expect(screen.getByText('审批中心')).toBeInTheDocument();
    expect(screen.getByText('其他（未挂菜单）')).toBeInTheDocument();

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(catalog.length);
    for (const c of catalog) {
      expect(screen.getByText(c.code)).toBeInTheDocument();
    }
  });
});
