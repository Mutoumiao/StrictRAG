# 回写：spec / 镜像 / 雾清单 / 兄弟图 + 对抗性复核

Type: task
Status: resolved
Blocked by: 03

## Question

把本图的结论落到**该被记住的地方**，并对每一处回写做**对抗性反向复核**（逐条核「这话在源码里真能指到吗」）。

必做：

1. **回写表**：逐行列 `文件` × `改了哪一段` × `依据（工单/源码 file:line）`。至少覆盖：
   - `.trellis/spec/api/backend/` 里检索 / 鉴权相关的包文（租户来源写成**可执行契约**：权威源是哪一处、不等时怎么办、将来新增入口怎么判）。**spec 里可以写行号**。
   - `docs/module-status/api.md`：技术债里簇 40 那条按裁定改写（销账 / 收窄 / 保留 + 销账条件），并加「最近更新」条目。**镜像里不写 `路径:行号`，不给裸枚举字面量加反引号。**
   - `docs/testing/coverage*.md` 里 AE8 相关行（若有变化）：缺口文字或取值按裁定与实测改。
   - `.scratch/fog-inventory-2026-09-23.md`：簇 **40** 行按裁定改写；簇 **8** 行的指针同步；必要时加一段日期追加段（写清本图销的是哪一格、没销的是哪一格）。
   - 兄弟图 `.scratch/retrieve-corpus-tenant-scope/map.md` 的 `Not yet specified` 里「ask 的租户权威源」那一条：标**已销**并指向本图。
   - 项目总 backlog（`.trellis/tasks/08-06-project-backlog/status.md`，**gitignored，磁盘-only**）里若有点名该债的行，同步为「已定案 + 指针」。
2. **对抗性复核**：另起一轮（可用子代理），逐条挑战本图的结论与回写：
   - 每一句「已具备 / 已收口 / 已断言」指到源码行是否真成立？
   - 计数、枚举、状态词（「全部」「唯一」「无消费者」）有没有反例？
   - 回写里有没有把「未实测」写成「已验证」、把「实现选择」写成「PRD 要求」？
   - 发现的问题**逐条修**，并记录修了什么。
3. **收口门禁**：在**最后一次提交之后**复跑 `pnpm check:module-status` —— `1-路径` / `6-联动` / `7-时效` 必须为空；其余类别的条数与立图前对比，新增噪声要能解释（或消掉）。
4. **收口声明**：`map.md` 的 `Status` 改为 `resolved（前沿：空；工单 01–04 全收口）`，补 `### 目的地达成（日期）`（逐条对着 Destination 的 7 条到达标准写），把剩下的雾搬进 `## Not yet specified`（带销账条件），把真正的划出项写进 `## Out of scope`，并写一节「该被记住的几句话」。
5. **提交**：本地 `commit`（**禁止 `push`**），只在本分支 `main`，不建 worktree。

## Answer

### 1 · 回写表

| # | 文件 | 改了哪一段 | 依据 |
|---|------|-----------|------|
| 1 | `.trellis/spec/api/backend/ask-pipeline.md` | 新增「Design Decision: 0b 租户一致性（入口租户 vs KB 行租户）」整节：Context（两处取值链 + 静默丢失 + 冻结明文）· Decision（判定点 / 比对双方 / 必填即防漂移及其**覆盖面边界** / 两条入口 / CLI 与残余）· 四条**禁止** | 工单 02 R1–R6 · 工单 03 |
| 2 | `.trellis/spec/api/backend/departments.md` | 可见性函数那段的「三处必须保留的差异」里 tenantId 一条补上本断言（并指向 ask-pipeline） | 工单 03 |
| 3 | `.trellis/spec/api/backend/quality-guidelines.md` | 「租户」行扩写（ask 检索期一致性 + 后果）；新增「租户（内口例外）」行（口令制、无令牌、自查 KB 行、KB 缺失 404） | 工单 02 R5 |
| 4 | `docs/module-status/api.md` | ① 技术债行按裁定**改写**（从「两源分裂 / 未实测 / 须先裁」→「已落 + 真 ES 数字 + 仍欠/划出 7 条」）② 「最近更新」前置新条目 ③ 证据表新增一行 | 工单 02 / 03 |
| 5 | `docs/testing/coverage/03-ops.md` | O1 行缺口列加「2026-10-10 追加」：ask 级租户一致性断言已落 + 测例路径 + 方向是「拒答」 | 工单 03 |
| 6 | `.scratch/fog-inventory-2026-09-23.md` | ① **簇 40** 行按「已解」改写 ② **簇 8** 行补「簇 40 已解、本簇依旧未修」 ③ 新增 **2026-10-10 追加段**（本图那段） | 工单 02 / 03 |
| 7 | `.scratch/retrieve-corpus-tenant-scope/map.md` | `Not yet specified` 的「ask 的租户权威源」条标**已销（2026-10-10）** + 指向本图 + 写明三条候选里哪条被否决 | 工单 02 |
| 8 | `.trellis/tasks/08-06-project-backlog/status.md`（**gitignored · 磁盘 only**） | §2.6 新增 `DEC-TENANT-SA`（超管跨租户，标为**两条 ADR 的字面张力**） | 工单 02 R8 |

### 2 · 对抗性复核（子代理，只读）发现与修复

复核**独立跑了 api 全套测试**（`187 passed / 1168 passed | 3 skipped`，与我声明逐位一致）与 `check:module-status`，并逐条到源码核了行号与断言。结论：两条主主张**成立**（「属补实现既有明文、无需 ADR」带保留 · 「既有断言零翻」实测成立，并确认全仓无漏网构造点、无「恰好没红」的语义漂移）。发现 **1 A + 3 B + 4 C**，**全部已修**：

| 编号 | 发现 | 修复 |
|------|------|------|
| **A1** | 复核时工单 04 仍 `pending`、`Answer` 为空，map 却已写 `resolved` 且「目的地达成」为空节 —— 读者会误以为回写已留档 | **本工单**补全 + map 补「目的地达成 / Not yet specified / Out of scope」（先落文档再提交） |
| **B3** | **裁定书 R5 与落地口径自相矛盾**：R5 写内口「KB 行取不到 → 拒（`not_member`）」，实现是 **404** | 按落地**修裁定书 R5**（并写明为什么是 404：内口是口令制机器接口，`kbId` 查不到属**请求错**，与同文件其它端点口径一致，worker 侧记 error 而非 abstained）；R7 用例清单同步改为 404 |
| **B1** | 「ADR-051 未写跨租户」措辞把它写成「无冲突」，实际是 ADR-051 `:1360`「内容与平台全路径」与 ADR-009「且 tenant 一致」的**字面张力** | 4 处（ask-pipeline · api.md 最近更新 · api.md 技术债 · backlog DEC 行）改写为「**存在张力**，按 ADR-009 判不例外，已登 `DEC-TENANT-SA` 记债」 |
| **B2** | 「必填即防漂移」的印象比事实宽：`apps/api/tsconfig.json` 的 `include` 只有 `src`（`tests/` 不进 `check-types`），且 CLI runner 的 `kbTenantId?` 是**可选回落** | ask-pipeline 与 api.md 各补「**覆盖面边界**」一句（tests 不进类型门；CLI 该参可选，靠测例与入口纪律） |
| **C1** | 雾清单簇 8 行「该簇已解决」指代含混（易读成簇 8 已修） | 改为「**簇 40 已解**；本簇依旧未修（`CorpusLoader` 仍未接）」（另修正一处笔误：`：1372` → `:1372`） |
| **C2** | 「缺 claim 时入口已回落」被写成全仓通用口径 | ask-pipeline 限定为「**在用户路由 `routes/ask.ts` 上**」；注明内口 / CLI 的 `tenantId` 分别是请求体与 env 值，没有该回落 |
| **C3** | R2 裁过的「令牌没声明租户」边界**无测例** | **新增第 8 例**（令牌不带 `tenantId` → 回落 → `answered`）；api 复跑 **1169 passed + 3 skipped**，用例表与计数同步 |
| **C4** | 残余清单漏记 dev 探针 `seed-es-sparse-probe.ts`（自取文档行租户 + **直连** `searchSparseEs`，绕过断言） | api.md 技术债 + 工单 03 残余各补一条（标「非生产 ask 入口，不在保护范围」） |

### 3 · 收口门禁（**最后一次提交之后**复跑）

- `pnpm check:module-status` → **47 条**（2 env + 13 符号 + 32 表），**`1-路径` / `6-联动` / `7-时效` 均为空**；与立图前**同数** ⇒ 本次回写未新增噪声（复核子代理另行确认新加的标识符一个都没进报告）。
- `pnpm test --concurrency=1` → **11 successful, 11 total**（api 187 文件 / 1169 passed + 3 skipped）。
- `pnpm check-types` 8/8 · `pnpm lint` 8/8（零 warning）。

### 4 · 收口声明

`map.md` 的 `Status` 改为 `resolved（前沿：空；工单 01–04 全收口）`，补 `### 目的地达成（2026-10-10）`（逐条对着 Destination 的 7 条到达标准）、`## Not yet specified`（7 条残余 + 销账条件）、`## Out of scope`（真正的划出项）与「该被记住的几句话」。

**未验证（如实）**：真栈**端到端**（起 api + 真 PG + 真 ES + 网关）本轮未做 —— 真 ES 上只做了**最小对照**（证明旧行为），新行为的验证停在图级 / 路由级。复核子代理亦**未重跑**该对照数字（采信工单 01 §7）。
