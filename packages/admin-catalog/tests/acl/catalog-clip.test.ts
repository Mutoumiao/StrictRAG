/**
 * 目标：码表、角色模板与菜单树必须一致，clip 后只保留有码且已落地的路由。
 * 需求：ADR-056
 * 被测：defaultCodesForRoles · filterMenuByCodes · clipMenuForShell
 * 简介：无 React；只校验码表、模板、菜单树一致且可裁剪。
 */

import { describe, expect, it } from 'vitest';

import {
  ADMIN_IMPLEMENTED_HREFS,
  clipMenuForShell,
  collectMenuHrefs,
  filterMenuByCodes,
  MENU_TREE,
} from '../../src/menu-tree.js';
import { defaultCodesForRoles } from '../../src/role-templates.js';

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

  it('kb_admin 含已实现运营路由（含反馈），无 /models /dashboard（默认无对应码）', () => {
    const codes = defaultCodesForRoles(['kb_admin']);
    const hrefs = collectMenuHrefs(clipMenuForShell(codes));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/documents',
        '/approvals',
        '/members',
        '/chunks',
        '/kb/settings',
        '/feedback',
      ]),
    );
    expect(hrefs).toHaveLength(6);
    expect(hrefs).not.toContain('/models');
    expect(hrefs).not.toContain('/dashboard');
  });

  it('super_admin 含 /dashboard /models /users /roles /departments（均已落地）', () => {
    const codes = defaultCodesForRoles(['super_admin']);
    const byCode = collectMenuHrefs(filterMenuByCodes(MENU_TREE, codes));
    expect(byCode).toContain('/dashboard');
    expect(byCode).toContain('/models');
    expect(byCode).toContain('/users');
    expect(byCode).toContain('/roles');
    expect(byCode).toContain('/departments');
    const clipped = collectMenuHrefs(clipMenuForShell(codes));
    expect(clipped).toContain('/dashboard');
    expect(clipped).toContain('/models');
    expect(clipped).toContain('/users');
    expect(clipped).toContain('/roles');
    expect(clipped).toContain('/departments');
    expect(ADMIN_IMPLEMENTED_HREFS.has('/dashboard')).toBe(true);
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
