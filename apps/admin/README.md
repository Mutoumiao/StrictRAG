# `@strict-rag/admin`

Next.js 管理端。目标端口 **3006**。

```bash
pnpm --filter @strict-rag/admin dev
# http://127.0.0.1:3006
```

## S2c 已落地（薄运营页）

| 路径 | 能力 | 权限码 |
|------|------|--------|
| `/login` | dev-login + 角色模板 | — |
| `/documents` | 文档列表 | `doc.view` |
| `/approvals` | 待审通过/驳回 · 通过后 scan | `approval.view` / `approval.decide` / `doc.upload` |
| `/members` | 列表/邀请/移除 | `member.manage` |

- 壳准入：`admin.shell`（`AdminAuthGuard`）
- 菜单：`@strict-rag/admin-catalog` 按码裁剪；**UI 藏按钮 ≠ API 授权**
- 顶栏手填 KB uuid（`localStorage`）
- 未批文档不可 scan（API ADR-048；UI 可见说明）

```bash
pnpm --filter @strict-rag/admin check-types
pnpm --filter @strict-rag/admin lint
```
