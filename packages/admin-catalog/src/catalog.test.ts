import { describe, expect, it } from 'vitest';

import { filterMenuByCodes, MENU_TREE } from './menu-tree.js';
import { defaultCodesForRoles } from './role-templates.js';

describe('defaultCodesForRoles', () => {
  it('doc_operator 无 approval.decide / member.manage', () => {
    const codes = defaultCodesForRoles(['doc_operator']);
    expect(codes.has('admin.shell')).toBe(true);
    expect(codes.has('doc.view')).toBe(true);
    expect(codes.has('approval.decide')).toBe(false);
    expect(codes.has('approval.view')).toBe(false);
    expect(codes.has('member.manage')).toBe(false);
  });

  it('kb_admin 含审批与成员管理', () => {
    const codes = defaultCodesForRoles(['kb_admin']);
    expect(codes.has('approval.decide')).toBe(true);
    expect(codes.has('approval.view')).toBe(true);
    expect(codes.has('member.manage')).toBe(true);
  });

  it('web_consumer 无 admin.shell', () => {
    const codes = defaultCodesForRoles(['web_consumer']);
    expect(codes.has('admin.shell')).toBe(false);
    expect(codes.size).toBe(0);
  });
});

describe('filterMenuByCodes', () => {
  it('doc_operator 菜单无审批中心 / 成员', () => {
    const codes = defaultCodesForRoles(['doc_operator']);
    const tree = filterMenuByCodes(MENU_TREE, codes);
    const labels = collectHrefs(tree);
    expect(labels).toContain('/documents');
    expect(labels).not.toContain('/approvals');
    expect(labels).not.toContain('/members');
    expect(labels).not.toContain('/chunks');
  });

  it('kb_admin 含 documents / approvals / members', () => {
    const codes = defaultCodesForRoles(['kb_admin']);
    const tree = filterMenuByCodes(MENU_TREE, codes);
    const hrefs = collectHrefs(tree);
    expect(hrefs).toContain('/documents');
    expect(hrefs).toContain('/approvals');
    expect(hrefs).toContain('/members');
  });

  it('空码集 → 无叶子菜单', () => {
    const tree = filterMenuByCodes(MENU_TREE, new Set());
    expect(collectHrefs(tree)).toEqual([]);
  });
});

function collectHrefs(nodes: { href?: string; children?: readonly { href?: string; children?: readonly unknown[] }[] }[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    if (n.href) out.push(n.href);
    if (n.children) out.push(...collectHrefs(n.children as typeof nodes));
  }
  return out;
}
