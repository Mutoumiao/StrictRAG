import { describe, expect, it } from 'vitest';

import {
  ADMIN_IMPLEMENTED_HREFS,
  clipMenuForShell,
  collectMenuHrefs,
  filterMenuByCodes,
  MENU_TREE,
} from './menu-tree.js';
import { defaultCodesForRoles } from './role-templates.js';

const UNLANDED = ['/dashboard'] as const;

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
    const labels = collectMenuHrefs(tree);
    expect(labels).toContain('/documents');
    expect(labels).not.toContain('/approvals');
    expect(labels).not.toContain('/members');
    expect(labels).not.toContain('/chunks');
  });

  it('kb_admin 含 documents / approvals / members', () => {
    const codes = defaultCodesForRoles(['kb_admin']);
    const tree = filterMenuByCodes(MENU_TREE, codes);
    const hrefs = collectMenuHrefs(tree);
    expect(hrefs).toContain('/documents');
    expect(hrefs).toContain('/approvals');
    expect(hrefs).toContain('/members');
  });

  it('空码集 → 无叶子菜单', () => {
    const tree = filterMenuByCodes(MENU_TREE, new Set());
    expect(collectMenuHrefs(tree)).toEqual([]);
  });
});

describe('clipMenuForShell', () => {
  it('doc_operator 仅落地且有码：/documents', () => {
    const codes = defaultCodesForRoles(['doc_operator']);
    const hrefs = collectMenuHrefs(clipMenuForShell(codes));
    expect(hrefs).toEqual(['/documents']);
  });

  it('kb_admin 含五条已实现运营路由，无 /models（默认无 model.gateway.manage）', () => {
    const codes = defaultCodesForRoles(['kb_admin']);
    const hrefs = collectMenuHrefs(clipMenuForShell(codes));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/documents',
        '/approvals',
        '/members',
        '/chunks',
        '/kb/settings',
      ]),
    );
    expect(hrefs).toHaveLength(5);
    expect(hrefs).not.toContain('/models');
    for (const u of UNLANDED) {
      expect(hrefs).not.toContain(u);
    }
  });

  it('super_admin 含 /models /users /roles；仍截断未落地 dashboard', () => {
    const codes = defaultCodesForRoles(['super_admin']);
    const byCode = collectMenuHrefs(filterMenuByCodes(MENU_TREE, codes));
    for (const u of UNLANDED) {
      expect(byCode).toContain(u);
    }
    expect(byCode).toContain('/models');
    expect(byCode).toContain('/users');
    expect(byCode).toContain('/roles');
    const clipped = collectMenuHrefs(clipMenuForShell(codes));
    for (const u of UNLANDED) {
      expect(clipped).not.toContain(u);
    }
    expect(clipped).toContain('/models');
    expect(clipped).toContain('/users');
    expect(clipped).toContain('/roles');
    for (const h of ADMIN_IMPLEMENTED_HREFS) {
      expect(clipped).toContain(h);
    }
  });

  it('空码 → 无链接', () => {
    expect(collectMenuHrefs(clipMenuForShell(new Set()))).toEqual([]);
  });

  it('自定义 implemented 可进一步收窄', () => {
    const codes = defaultCodesForRoles(['kb_admin']);
    const onlyDocs = new Set(['/documents']);
    const hrefs = collectMenuHrefs(clipMenuForShell(codes, MENU_TREE, onlyDocs));
    expect(hrefs).toEqual(['/documents']);
  });
});
