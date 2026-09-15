# 角色与权限树状勾选最小闭环

Type: task
Label: wayfinder:task
Status: pending
Assignee: —
Triage: ready-for-agent
Blocked by: 86

## Question

补 P2 运营面真空：角色与权限页是**扁平勾选**，但 IA 与安全 PRD 都冻成**树状**。页头文案已自称「树状授码」，实现是 `catalog.map` 单层网格。

权威：`prds/00-product/05-frontend-ia.md` §2.4「编辑 = **树**（L1/L2 菜单 + 操作）勾选 code」；功能表 §4.1「角色与权限｜树状勾选菜单/操作码」P2；`prds/09-security/01-auth-acl-compliance.md`「角色树 UI｜P2 必达」；ADR-056 权限码 + 菜单。

现状（源码）：

- `apps/admin/src/app/(ops)/roles/_components/roles-workspace.tsx` — 扁平 `catalog.map` 勾选网格；页头文案已写「树状授码」但实现不是树
- `packages/admin-catalog/src/menu-tree.ts` — `MENU_TREE` 已存在，且**已被壳消费**（`apps/admin/src/components/admin-shell.tsx` 菜单裁剪）
- 角色页当前**不** import `@strict-rag/admin-catalog`
- `packages/admin-catalog` 已是 admin 的依赖
- 超管全码锁（工单 31）现在是前端禁用 + 后端 400，本张**不改**该语义

口径：

- 角色编辑按 `MENU_TREE` 分组渲染：L1 菜单 → L2 菜单 → 其下操作码
- **禁止静默丢码**：未挂到任何菜单节点的码必须仍可见可勾（单独一组，如「未分类」），否则运营会丢权限
- 勾选 / 保存 / 超管锁全码语义与现状一致；**不改**鉴权语义与 API
- 禁止新增原生 `<select>`
- 测例禁止依赖墙钟

### 做

- admin：角色页按菜单树分组勾选；未分类码兜底分组可见；超管锁呈现不变
- 测例：
  - admin：树分组渲染 L1/L2 与操作码；未挂树码仍可见；超管锁全码仍禁用

### 不做

- 改鉴权语义 / 码表 / 契约 / `permission_definitions` 加层级列
- 改 API 或菜单裁剪
- 分片策略审计 / 参数快照审计 / 签字包链 / 断线重拉 / 入场 `aclPrincipals` / citation 去重 / 孤儿清理
- 默认开 `DEPT_ACL_ENFORCE` / 角色 principal / 默认开 OCR / 真引擎
- 改 `prds/00–11`

收工：`.trellis/spec/` admin quality-guidelines + module-layering、admin-catalog（若需）；`docs/module-status/` admin · admin-catalog。禁止 push。禁止 `task.py create`。
