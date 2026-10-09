/**
 * 目标：管理写审计对全量 mutating 路由是全覆盖的，且例外表紧致（新写路由不显式决定即红）。
 * 需求：ARCH-P1b-2 口径「默认全审 + 显式例外」· wayfinder 图 .scratch/admin-write-audit-scope 工单 02 裁定 R6。
 * 被测：shouldAuditAdminWrite / isAuditExcluded / AUDIT_EXCLUSIONS + createApp().routes
 * 简介：从真实 app 路由表枚举 mutating 路由按 (method,path) 去重后逐条断言；例外正则**在 mutating 路由集上多命中一条已注册路由**即红。
 */

import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import {
  AUDIT_EXCLUSIONS,
  isAuditExcluded,
  shouldAuditAdminWrite,
} from '../../src/middleware/admin-write-audit.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type Route = { method: string; path: string };

/**
 * 真实 app 的全部 mutating 路由（按 `(method,path)` 去重）。
 * 必须去重：`app.routes` 按 handler 逐条展开，一条路由挂 N 个 handler 会出现 N 条同 method+path。
 */
function mutatingRoutes(): Route[] {
  const seen = new Map<string, Route>();
  for (const r of createApp().routes) {
    const method = r.method.toUpperCase();
    if (!MUTATING.has(method)) continue;
    const key = `${method} ${r.path}`;
    if (!seen.has(key)) seen.set(key, { method, path: r.path });
  }
  return [...seen.values()].sort((a, b) =>
    a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path),
  );
}

describe('管理写覆盖面对全量 mutating 路由', () => {
  it('每条 mutating 路由要么被审计、要么被某条例外逐字声明', () => {
    const declared = new Set(AUDIT_EXCLUSIONS.flatMap((e) => e.routes));
    const undecided = mutatingRoutes()
      .filter((r) => !shouldAuditAdminWrite(r.method, r.path) && !declared.has(r.path))
      .map((r) => `${r.method} ${r.path}`);
    expect(undecided).toEqual([]);
  });

  it('每条例外恰好覆盖它声明的 mutating 路由（在 mutating 路由集上多命中一条即红）', () => {
    const routes = mutatingRoutes();
    for (const ex of AUDIT_EXCLUSIONS) {
      expect(ex.reason.length).toBeGreaterThan(0);
      expect(ex.routes.length).toBeGreaterThan(0);
      const matched = routes.filter((r) => ex.pattern.test(r.path)).map((r) => r.path);
      expect([...new Set(matched)].sort()).toEqual([...ex.routes].sort());
      for (const p of ex.routes) {
        expect(routes.some((r) => r.path === p)).toBe(true);
      }
    }
  });

  it('计数快照：审计 + 例外 = 全量 mutating（新增写路由必须显式决定并更新此数）', () => {
    const routes = mutatingRoutes();
    const audited = routes.filter((r) => shouldAuditAdminWrite(r.method, r.path));
    const excluded = routes.filter((r) => !shouldAuditAdminWrite(r.method, r.path));
    expect(audited.length + excluded.length).toBe(routes.length);
    expect(audited.length).toBe(39);
    expect(excluded.length).toBe(11);
    expect(routes.length).toBe(50);
  });

  it('例外表与判定方向一致：命中例外即不审，未在例外表的新写路径默认被审', () => {
    for (const ex of AUDIT_EXCLUSIONS) {
      for (const p of ex.routes) {
        const concrete = p.replace(/:[^/]+/g, 'x');
        expect(isAuditExcluded(concrete)).toBe(true);
        expect(shouldAuditAdminWrite('POST', concrete)).toBe(false);
      }
    }
    // 默认方向：既不在例外表、又不是基础设施的写路径 → 审（将来新路由不会静默免审）
    expect(shouldAuditAdminWrite('POST', '/api/v1/knowledge-bases/kb1/future-write')).toBe(true);
    expect(isAuditExcluded('/api/v1/knowledge-bases/kb1/sessions/extra')).toBe(false);
  });
});
