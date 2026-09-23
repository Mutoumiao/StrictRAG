# 落地：acl 分册五行（S1 · S4 · Y6 · X4 · X5）

Type: task
Status: open
Blocked by: 02-dec-per-row-ruling

## Question

按工单 02 的裁定，把 acl 分册这五行收口到位：

- `S1`（仅 KB-A `read` 打开 admin → **403 或** 302→web）
- `S4`（KB-A `read` + KB-B `write` → **可进** admin）
- `Y6`（无 `admin.shell` 打开 admin → **403**/302→web）
- `X4`（`docTypes:["no_such_type"]` → **400**）
- `X5`（dense 与 ES filter 均含 `doc_type∈hr`；对称）

落地范围（以工单 02 裁定为准）：

1. **壳三行（S1 / S4 / Y6）**：`apps/admin/src/components/auth-guard.tsx` 今天的行为是「无会话 / 无平台码 → 清会话 + `router.replace('/login')`」。裁定分支二选一：
   - 若裁定「壳语义可核对的等价观测 = 壳不可用 + 清会话 + 跳 `/login`」→ **订正覆盖表口径**，并在 `apps/admin/tests/shell/auth-guard.test.tsx` 补**专断言**（分别钉 S1 / Y6 的「无码即不进壳」与 S4 的「进壳只认平台码，与 KB 角色无关」）。**不许**改壳行为。
   - 若裁定「源码该改」→ 只允许**加严**（变得更保守）；且因本机**无浏览器**，必须在 Answer 里写清「只经 RTL 单测验证，未做浏览器验证」。
2. **`X4`**：`apps/api/src/services/kb-settings.ts` 的 `assertScopeDocTypesAllowed` 在 KB **未配** `docTypes` 时放行任意类型。若裁定为「源码缺实现」→ 改成**未配置时也不放行未知类型**（加严），并核对是否会打红既有测例（`apps/api/tests/kb/ask-mode-doc-types.test.ts` · `apps/api/tests/ask/mode-doc-types-gate.test.ts`）；既有测例若**因加严而变红**，须逐条判断是「旧断言钉的是旧行为」还是「新行为错」，**不许**直接改断言让它变绿。
3. **`X5`**：`apps/api/src/services/retrieve/es-sparse.ts` 查询期无 `doc_type` filter。真销账须真 ES（B8，已划出）→ 按裁定记为「源码缺实现 + 阻塞方 = B8」，并把该行缺口列改写成可核对的话；**若**裁定为「可在 mock / 纯函数层加一条对称性断言」，则加在不依赖真 ES 的层面并写清它**证明不了**什么。
4. **覆盖表**：`docs/testing/coverage/02-acl.md` 这五行的「缺口」列按统一写法改写，覆盖值按裁定重判；该册末尾的「部分测」清单与「源码侧待定」字样同步。

纪律：

- **不许**改 `prds/*`；**不许**改 `AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` 的默认值；**不许**放宽任何 403 语义。
- **不许**为了让某行变绿而把断言从「403」改成「200」或反之——那属放宽 / 收紧口径，须有裁定支撑。
- `X4` 若加严，必须同时确认 `prds/05-api` / `prds/09-security` 里的对应条款**本来就支持**加严（引用原文），否则只能记债。
- 收尾跑 `pnpm check-types` + `pnpm lint` + `pnpm run test --filter @strict-rag/api --filter @strict-rag/admin`。

## 产出

- 源码 / 测例 / 覆盖表改动（可提交的 diff）。
- 本工单 `## Answer`：五行逐行的「收口动作 → 文件 → 证据」+ 反证记录 + （若动了壳行为）「未经浏览器验证」的声明。
