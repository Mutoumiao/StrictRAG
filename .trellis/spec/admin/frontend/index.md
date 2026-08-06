# @strict-rag/admin · 管理端前端

> 路径：`apps/admin` · 目标端口 **3006**  
> 现状：**S2c 薄运营页**（登录 · 壳 · 文档/审批/成员最小 UI）；**非**完整运营台（设置/供应商/部门/面板等见 backlog）。

---

## Pre-Development Checklist

- [ ] 是否管理端能力（KB/成员/文档/审批/评测）而非用户 ask 主路径？  
- [ ] 权限码 / 菜单是否来自 `@strict-rag/admin-catalog`？  
- [ ] API 类型是否来自 `@strict-rag/contracts`？默认不建平行 wire `types.ts`？  
- [ ] UI 是否优先 `@strict-rag/ui`（`cn` / theme）？  
- [ ] 壳准入是否按 **`admin.shell`**（非旧 role 公式），且不靠前端藏路由？  
- [ ] 菜单裁剪是否 `filterMenuByCodes` + 落地 href 白名单？  
- [ ] 后端 path 是否只在模块 `api.ts` / `auth/api`（services **禁止**写 URL）？  
- [ ] 业务用例是否在 `services` / `*.services.ts`；hooks 是否仅 React 绑定且不与 services 双轨？  
- [ ] `page.tsx` 是否保持薄组合；UI 是否不直接业务 `fetch`？  
- [ ] store / hooks 目录 / types 是否「有需要才建」？services 膨胀是否按 **业务用例** 拆分？  
- [ ] services 是否不做权限引擎（无码树/role 放行）；授权是否仍以 **API 验码** 为准、UI 只裁剪？  
- [ ] 抽公共是否对照 [module-layering §12.1](./module-layering.md)（A 欠抽 / B 过抽；优先纯函数再薄 hook）？  

## Quality Check

- [ ] 无密钥、无服务端 DB URL  
- [ ] 按钮可见 ≠ API 已授权（双罪禁止）  
- [ ] 分层符合 [module-layering](./module-layering.md)  
- [ ] **抽公共**：有无 A1～A4 欠抽（≥3 处同形纯逻辑、≥4 模块同步改协议、path/wire 复制）？有无 B1～B4 过抽（仅形状像就上帝 hook / options 丛林 / 空 hooks）？见 [§12.1](./module-layering.md)  
- [ ] `pnpm --filter @strict-rag/admin check-types` · `lint`  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状布局 · 目标模块树摘要 |
| [module-layering](./module-layering.md) | **page / api / services / hooks / store 分层纪要**（强制） |
| [quality-guidelines](./quality-guidelines.md) | 质量与 RBAC UI |

## 依赖

`@strict-rag/admin-catalog` · `@strict-rag/contracts` · `@strict-rag/ui`

## PRD 映射

- `prds/00-product/05-frontend-ia.md`  
- `product.pen`  
- ADR-045（经 **051** 修订为 `admin.shell`）· ADR-051 · ADR-056  
- IS：`docs/module-status/admin.md`
