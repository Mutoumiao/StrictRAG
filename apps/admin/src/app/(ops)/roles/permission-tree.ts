/**
 * 角色授码树（IA §2.4）：按 admin-catalog 菜单树把权限码分组。
 * L1 菜单 → L2 菜单 → 该节点下的操作码。
 * 未挂到任何菜单节点的码落「其他（未挂菜单）」，**禁止静默丢码**。
 */

import { MENU_TREE, type MenuNode } from '@strict-rag/admin-catalog';

/** 菜单树里没有对应节点的操作码 → L2 节点 id（节点自带 permission 的码不必登记） */
const ACTION_NODE_ID: Record<string, string> = {
  'doc.upload': 'docs',
  'doc.editor': 'docs',
  'doc.lifecycle': 'docs',
  'doc.reindex': 'docs',
  'approval.decide': 'approvals',
};

export const UNGROUPED_GROUP_ID = '__ungrouped';

export type PermissionTreeItem = {
  id: string;
  label: string;
  /** 该节点下可勾的码，按 catalog 顺序 */
  codes: string[];
};

export type PermissionTreeGroup = {
  id: string;
  label: string;
  items: PermissionTreeItem[];
};

type CatalogLike = { code: string };

/** 收集树中有 permission 的叶子节点：code → { 节点 id, 标签, L1 标签 } */
function leafNodes(tree: readonly MenuNode[]): Map<string, { nodeId: string; label: string }> {
  const out = new Map<string, { nodeId: string; label: string }>();
  for (const l1 of tree) {
    for (const l2 of l1.children ?? []) {
      if (l2.permission) out.set(l2.permission, { nodeId: l2.id, label: l2.label });
    }
  }
  return out;
}

/**
 * 把 catalog 码编成两级树。每个码最多出现在一个节点下；
 * 树里找不到节点的码落「其他（未挂菜单）」，调用方可据此断言无丢码。
 */
export function buildPermissionTree(
  catalog: readonly CatalogLike[],
  tree: readonly MenuNode[] = MENU_TREE,
): PermissionTreeGroup[] {
  const leaves = leafNodes(tree);
  const codes = catalog.map((c) => c.code);

  const groups: PermissionTreeGroup[] = tree.map((l1) => ({
    id: l1.id,
    label: l1.label,
    items: (l1.children ?? [])
      .filter((l2) => l2.permission)
      .map((l2) => ({
        id: l2.id,
        label: l2.label,
        codes: [] as string[],
      })),
  }));

  // 节点先建齐再落码：page 码缺席时，其操作码仍须落在本节点，不得被挤到「其他」
  const itemByNodeId = new Map<string, PermissionTreeItem>();
  for (const g of groups) {
    for (const item of g.items) itemByNodeId.set(item.id, item);
  }

  const ungrouped: string[] = [];
  for (const code of codes) {
    const nodeId = leaves.get(code)?.nodeId ?? ACTION_NODE_ID[code];
    const item = nodeId ? itemByNodeId.get(nodeId) : undefined;
    if (item) {
      item.codes.push(code);
    } else {
      ungrouped.push(code);
    }
  }

  const out = groups
    .map((g) => ({ ...g, items: g.items.filter((it) => it.codes.length > 0) }))
    .filter((g) => g.items.length > 0);
  if (ungrouped.length > 0) {
    out.push({
      id: UNGROUPED_GROUP_ID,
      label: '其他（未挂菜单）',
      items: [{ id: UNGROUPED_GROUP_ID, label: '未挂菜单的码', codes: ungrouped }],
    });
  }
  return out;
}
