# 读面成员闸的姿态与先后顺序

Type: grilling
Status: resolved
Blocked by: 01

## Question

读入口挂成员闸时要不要新造一套口径？与既有 `docReadDenied` / `deniedDocReadMessage` 谁先谁后？`AUTH_ENFORCE` 关、请求根本没有 `auth` 时怎么处理？

## Answer

**不新造口径，直接沿用前图工单 14 的两条规则。**

### 1. 姿态随码（唯一规则）

| 该入口的权限码 | 闸姿态 | 行为 |
|----------------|--------|------|
| `requirePermission`（始终验码） | `always` | 始终查成员（有码无成员 → 403） |
| `requirePermissionWhenEnforced` | `whenEnforced` | `AUTH_ENFORCE` 开 → 查；关 → **不查**（跳过） |

落到本图：`chunks` 两个入口 = `always`；`documents` 三个 = `whenEnforced`。

这条规则的价值在于**可解释**：下一次核查不必重议「读面到底该多严」，只要看该入口的码是哪种姿态即可。它同时满足「不翻转仓库默认」——`AUTH_ENFORCE` 关时 `WhenEnforced` 系本就没有 `auth`，若强行查成员会把 dev / demo 读路径打成 401，那是改默认。

### 2. 顺序：成员闸是外层

```
权限码（中间件）
  → 成员闸（handler 级，本图新增）      ← ADR-035 §4「无 kb_members 行 → 内容路径 403」
  → 第二层：部门 ACL + aclPrincipals     ← 既有 docReadDenied / deniedDocReadMessage
```

理由：ADR-035 把「成员行」列为该 KB **一切内容路径**的前置；部门 / 名单是在「已进入该库」之后才谈的可见级。反过来（先部门后成员）会让非成员收到「部门不匹配」这类**泄漏库内结构**的文案。

拒绝文案复用 `evaluateKbMember` 的既有 403 `FORBIDDEN` + `not a knowledge base member`，与写面一致；不新增 BizCode。

### 3. `super_admin` 旁路

沿用 `evaluateKbMember` 内建的 `roleBypassesKbMembership` 旁路（`auth/middleware.ts:240`），不另开口子。`GET …/acl` 的既有测例（超管旁路 200）必须继续绿。

### 4. 实现落点：不应再放 route 私有 helper

前图把写面闸写成 `documents/index.ts` 里的私有 helper，导致 **chunks 路由无法复用**。而 `apps/api/src/auth/kb-scope.ts` 顶部明写「中间件 / handler **共用**，**禁止 route 私写** resolve + bypass」。故本图：

1. 把闸抽到 `apps/api/src/auth/` 下的共享模块（与 `kb-scope.ts` 同域），导出 `docMemberDenied(c, kbId, posture)` 与 `DocScopeDeps`（`resolveKbMember`）。
2. `documents/index.ts` 与 `chunks.ts` 都从该模块取闸；`documents/index.ts` 的 10 个写入口调用点改名（机械替换），行为不变。
3. 两处 `DocumentRouteDeps` / `ChunkRouteDeps` 都保留 `resolveKbMember?` 注入（测例用）。

**约束**：抽模块是纯搬迁，不得顺手改闸语义；搬迁后前图新增的 `tests/acl/doc-write-kb-member-gate.test.ts` 必须仍全绿（这是搬迁的回归证明）。
