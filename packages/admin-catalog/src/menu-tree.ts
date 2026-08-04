import type { PermissionCode } from './permissions.js';

/**
 * Admin 菜单树（ADR-056）：二级项绑定 page 码；前端裁剪、后端仍须验码。
 */

export type MenuNode = {
  id: string;
  label: string;
  href?: string;
  /** 可见所需 page 码；缺省表示仅需 admin.shell */
  permission?: PermissionCode;
  children?: readonly MenuNode[];
};

export const MENU_TREE: readonly MenuNode[] = [
  {
    id: 'overview',
    label: '概览',
    children: [
      {
        id: 'dashboard',
        label: '数据面板',
        href: '/dashboard',
        permission: 'dashboard.view',
      },
    ],
  },
  {
    id: 'kb',
    label: '知识库',
    children: [
      { id: 'docs', label: '文档', href: '/documents', permission: 'doc.view' },
      { id: 'chunks', label: '分片', href: '/chunks', permission: 'chunk.view' },
      {
        id: 'approvals',
        label: '审批中心',
        href: '/approvals',
        permission: 'approval.view',
      },
      {
        id: 'members',
        label: '成员',
        href: '/members',
        permission: 'member.manage',
      },
      {
        id: 'kb-settings',
        label: '知识库设置',
        href: '/kb/settings',
        permission: 'kb.config.write',
      },
    ],
  },
  {
    id: 'system',
    label: '系统',
    children: [
      { id: 'users', label: '用户', href: '/users', permission: 'user.manage' },
      {
        id: 'roles',
        label: '角色与权限',
        href: '/roles',
        permission: 'role.perm.manage',
      },
      {
        id: 'models',
        label: '模型网关',
        href: '/models',
        permission: 'model.gateway.manage',
      },
    ],
  },
] as const;

/** 按有效码裁剪菜单（UI 层；不能替代 API 验码） */
export function filterMenuByCodes(
  tree: readonly MenuNode[],
  codes: ReadonlySet<string>,
): MenuNode[] {
  const walk = (nodes: readonly MenuNode[]): MenuNode[] => {
    const out: MenuNode[] = [];
    for (const node of nodes) {
      if (node.permission && !codes.has(node.permission)) {
        continue;
      }
      const children = node.children ? walk(node.children) : undefined;
      if (node.children && (!children || children.length === 0) && !node.href) {
        continue;
      }
      out.push({
        ...node,
        children,
      });
    }
    return out;
  };
  return walk(tree);
}
