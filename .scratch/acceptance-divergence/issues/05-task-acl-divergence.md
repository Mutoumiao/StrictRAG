# 落地：acl 分册五行（S1 · S4 · Y6 · X4 · X5）

Type: task
Status: claimed（主控 2026-09-23 认领；实现子代理执行）
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

## Answer

**五行归属与覆盖值（终值）**：`S1` = 乙（实质）+ 债 → `部分测`（保留） · `S4` = 乙 → **`已测`** · `Y6` = 乙（实质）+ 债 → `部分测`（保留） · `X4` = 乙 → **`已测`** · `X5` = 丁 → `部分测`（保留）。

**逐行收口（动作 → 文件 → 证据）**

1. `S1`：覆盖表 S1 行缺口列改写为「已裁定：乙（实质）+ 债」并补 `it` → `apps/admin/tests/shell/auth-guard.test.tsx:79`（`S1/Y6：web_consumer 空码 → 清会话 + /login，不进壳子树`）；依据 `apps/admin/src/components/auth-guard.tsx:41-46` + ADR-045（`:957`）已被 ADR-051（`:1344`）修订。
2. `S4`：补 `it`（① KB 角色锚点 + 无壳码 → 不进壳；② 同锚点 + `admin.shell` → 进壳）→ 同文件 `:106`（`S4：进壳只认 admin.shell，KB 角色（read / write）不参与判定`）；依据 `packages/admin-catalog/src/role-templates.ts:19`/`:24` · `apps/api/src/auth/role-hydrate.ts:111` · `apps/api/src/auth/permissions/resolve.ts:22`。
3. `Y6`：与 `S1` 同一 `it`、同一条债 → 覆盖表 Y6 行缺口列同源改写。
4. `X4`：**不动源码**（`apps/api/src/services/kb-settings.ts:273` 保持原样）+ 覆盖值 `已测` → 证据 `apps/api/tests/ask/mode-doc-types-gate.test.ts:134`；依据 ADR-050（`prds/11-decisions/00-adr-index.md:1308`）+ `prds/12-delivery-guides/04-交付控制台.md:124`；`apps/api/tests/kb/ask-mode-doc-types.test.ts:52` 仍钉「空白名单放行」（未改）。
5. `X5`：**不动 `apps/api/src/services/retrieve/es-sparse.ts`**；缺口列精确化为「净效果对称（`corpus.ts:44-47` + `retrieve.ts:212`），ES 查询体不含 `doc_type`」，阻塞方 = 真 ES（B8）。

**新增 `it` 名单**（`apps/admin/tests/shell/auth-guard.test.tsx`，5 例全绿，无删改既有断言）：`S1/Y6：web_consumer 空码 → 清会话 + /login，不进壳子树`（`:79`）· `S4：进壳只认 admin.shell，KB 角色（read / write）不参与判定`（`:106`）。

**主控订正（2026-09-24，工单 07 反向复核抓到）**：上面两处原本写 `:107`，实际 `grep` 为 `:106`（差一行）。已改；这正是本图要治的「转述漂移」，记下来当本图的第三条教训。

**覆盖表改动**（`docs/testing/coverage/02-acl.md`）：五行缺口列改定型写法（「源码侧待定 / 待补测」命中 0）；计数 `已测 56→58`、`部分测 8→6`（合计仍 69）；尾注改为「**部分测**（P2必签/契约/授码）：S1 S3 · Y6 · X5」（`S4` / `X4` 移出）、删「S1 / S4 / Y6 / X4 / X5 为源码侧待定」两处、新增第六轮叙述。

**脚本核计数（按行机械，非肉眼）**：数据行 `69` · 已测 `58` · 部分测 `6` · 缺测 `0` · 缺实现 `2` · 延后 `0` · UAT `3`；与计数表声明逐项「一致」（声明合计 69 = 行级合计 69）；ID 去重 `69`；禁用词命中 `0`；五目标行现值 S1=部分测 · S4=已测 · Y6=部分测 · X4=已测 · X5=部分测。

**反证**：① S1/Y6 断言改坏为 `replace ... '/ops'` → `Tests 1 failed | 4 passed`（红），**还原后绿**（`5 passed`）；② S4 ①段有效码改坏为 `['admin.shell']` → `Tests 1 failed | 4 passed`（红），**还原后绿**（`5 passed`）。

**门禁（原始结果）**：`pnpm check-types` → `Tasks: 8 successful, 8 total`；`pnpm lint` → `Tasks: 8 successful, 8 total`（`--max-warnings 0`，零 warning）；`pnpm run test --filter @strict-rag/api --filter @strict-rag/admin --filter @strict-rag/admin-catalog` → `Tasks: 7 successful, 7 total`（api `Tests 1099 passed | 3 skipped (1102)`；admin `187 passed (187)`；admin-catalog `13 passed (13)`）。

**守约三句**：未改 `apps/admin/src/components/auth-guard.tsx` 的壳行为 · 未加严 `assertScopeDocTypesAllowed` · 未动 `es-sparse.ts` 的 ES 查询。另：未改 `prds/` / `fixtures/` / 任何默认开关（`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN`），未建分支 / 未 commit / 未 push。

**admin 壳相关结论仅经 RTL 单测验证，未做浏览器验证。**
