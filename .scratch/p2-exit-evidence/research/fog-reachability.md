# 上一图雾中项 · 可达性核定（2026-09-20）

- 逐条核定来源：`.scratch/close-p2-exit-gaps/map.md` 的「Not yet specified」10 条，逐条读原文后对 HEAD 源码/PRD 复核。
- 结果：**今天可做 4 项**（#5 admin 审阅面 · #6 admin 站规清扫（行为级）· #7 drizzle 基线 · #9 覆盖表部分测余量）· **需先补 PRD 或 ADR 3 项**（#1 · #2 · #4）· **被外部依赖阻塞 1 项**（#3 真 Langfuse）· **无对象 2 项**（#8 · #10）。
- 「改冻结语义」列全为「否」：4 项可做项都只动镜像 / UI / 工程债 / 测例，不碰 `prds/00–11` 条款；#1 · #2 · #4 若要动手则须先补冻结口径（PRD 补行或新 ADR）。
- 附带更正：`research-drizzle-meta-baseline.md` 的**机制结论今天仍成立**，但编号已过期——缺口从 19 份（`0001`–`0019`）增至 **21 份（`0001`–`0021`）**，基线快照应命名 **`0021_snapshot.json`**（不能叫 `0022`，那是下一次 `generate` 要写出的名字）。
- 读法声明：本文件只做可达性判断，不展开覆盖表逐行盘点（那是另一研究员的活）；未运行任何写仓命令，未跑 `drizzle-kit generate`。

| # | 项 | 今天有无对象（路径） | 外部阻塞 | 是否动冻结语义 | 可达性结论 | 最小可验证切片 |
|---|----|----------------------|----------|----------------|------------|----------------|
| 1 | `pending_review` 的 interim 可配置性 | 有落点无键名：`prds/04-pipelines/01-offline-ingest.md:241`（「双方可暂均 index 或均不 index（KB 策略）」，**未给键名**）· `apps/worker/src/ingest/pipeline.ts:553,581`（硬编码「暂不 index」）· `packages/contracts/src/kb/kb-settings.contract.ts:74-80,148-151` · `apps/api/src/services/kb-settings.ts:307,373-376` | 无（纯本仓） | 是 —— 补键名 = 补 `prds/04` §5.1 冻结行（须 ADR → 改 PRD → 升 `prds/README.md` 版本） | **需先补 PRD 或 ADR** | —（PRD 给出键名与取值后再开票） |
| 2 | embed TPM / 堆积告警（R6-b） | 有验收行与指标名、无计数口径：`prds/06-async/01-bullmq-jobs.md:192` · `prds/07-models/01-model-gateway.md:319`（`ingest_embed_backlog`）· `prds/11-decisions/00-adr-index.md:909-910`（ADR-044 #3）· `apps/worker/src/ingest/embed-http.ts:29-31` | 真网关 429（真密钥）—— 端到端不可验；注入式可验 | 是 —— 「触顶」判定口径未冻，补口径须改 `prds/07` §7.1 / 新 ADR（ADR-044 明写「演进须新 ADR」） | **需先补 PRD 或 ADR** | —（先冻 TPM 计数口径或 ADR 声明 mock 不计数） |
| 3 | 真 Langfuse 读取面的成员过滤 / 哈希载体 | 只有 mock，无读取面：`apps/api/src/obs/ask-tracer.ts:19-73`（mock export）· `apps/api/src/env.ts:146-155` · 要求面 `prds/08-quality/03-langfuse-observability.md:148,151,173` | 真 Langfuse SDK / 密钥（外部） | 否（`prds/08` 只加严不改既有 ask 语义） | **被外部依赖阻塞** | —（接真 SDK 时随读取面一起落） |
| 4 | `downrank` 跨 doc 去重动作 | 无实现对象：`prds/04-pipelines/01-offline-ingest.md:240`（「仍索引但 metadata 降权（检索层读取）」）· `apps/worker/src/ingest/cross-doc-dedupe.ts:27`（脏值回落 `skip_index`）· `packages/contracts/src/kb/kb-settings.contract.ts:150`（400 拒绝）· `apps/api/src/services/retrieve/scoring.ts`（只有 cosine / 稀疏重叠 / RRF，无降权位） | 无（纯本仓） | 是 —— 降权字段与权重口径未冻（ADR-014 只给了动作名），实现前须补 `prds/04` §5.1 或新 ADR | **需先补 PRD 或 ADR** | — |
| 5 | `pending_review` 的 admin 审阅面（功能表 §4.3） | 齐全：`prds/12-delivery-guides/14-模块需求功能表.md:299`（P1 必达「须人工二选一」）· 端点 `apps/api/src/routes/documents/index.ts:626` · DTO `packages/contracts/src/ingest/ingest-report.contract.ts:11-18`（带 `heldChunkId`）· 报告面 `apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx:1186-1203`（只列 `otherDocId`，无二选一控件） | 无 | 否（功能表属交付配套，非 `00–11` 契约） | **今天可做** | 在文档页入库报告里对 `action=pending_review` 的冲突对加「保留本块 / 保留对方块」，调 `POST /documents/:docId/dedupe-conflicts/:chunkId/resolve`；RTL 测例断言请求体 `{winner}` 与提示文案。 |
| 6 | admin 站规清扫（原生 `<select>` → ui 关闭列表） | 20 处原生 `<select>` + 3 处旧 ui `Select`：`apps/admin/src/app/(ops)/departments/_components/departments-workspace.tsx:345,433,467,519,549,567` · `documents/_components/documents-workspace.tsx:702,805,842,931,963,1002,1136` · `models/_components/models-workspace.tsx:320,406,475` · `kb/settings/_components/settings-workspace.tsx:254,320` · `kb/settings/_components/chunk-strategy-panel.tsx:148` · `eval/_components/eval-workspace.tsx:215`；目标件 `packages/ui/src/components/ui/closed-select.tsx`（`index.ts:12` 导出）；站规 `.trellis/spec/admin/frontend/quality-guidelines.md:106,122` | **视觉回归**=浏览器（本机无，仓内无 playwright / 视觉 diff）；**行为级无阻塞** | 否（站规是 HOW / 交付配套） | **今天可做（行为级）** | 单文件替换起步（departments 6 处）：原生 `<select>` 换 `ClosedSelect`，RTL 断言 listbox 选项、选择回调值、空态；视觉回归显式记为不可验。 |
| 7 | `drizzle/meta` 基线缺失 | 有：`packages/db/drizzle/meta/`（只有 `0000_snapshot.json` + `_journal.json`）· `packages/db/package.json:15`（`db:generate`）· `packages/db/drizzle.config.ts` · 台账 `docs/module-status/db.md:50-53` | 无（`generate` 不连库、不读实库；只**要求在仓外副本**执行） | 否（工程债，PRD 无对应条款） | **今天可做** | 仓外副本生成当前 schema 快照，落 `packages/db/drizzle/meta/0021_snapshot.json`；`drizzle-kit generate` 打印 `No schema changes, nothing to migrate 😴` 即完成。 |
| 8 | `allowedDocIds` 收紧路径 / 成员写面 | 无对象：全仓 10 处命中全是文档或负向测试（`docs/testing/coverage/02-acl.md:33,35,36` · `apps/api/tests/acl/members-http.test.ts:204` · `packages/contracts/tests/ask/contract.test.ts:113`）；DB 无列、`retrieve` 无该 reason 出口 | 无生产者（准入条件未满足） | 是 —— 成员写面被 `prds/05-api` §2.2 冻结为 `body: { role }`，放开须改 PRD | **无对象** | —（先指名真实生产者，或书面判定为保留码） |
| 9 | 覆盖表 P2 必签「部分测」余量 | 有：`docs/testing/coverage.md:13,82`（读法 + 补测顺序）+ 4 分册；≈130 行含「部分测」，其中 **86 行**同时标 `P2必签`（00-ask 18 · 01-ingest 26 · 02-acl 22 · 03-ops 20） | 无（补测本身离线）；部分行的「缺口」指向真 ES / 真引擎 —— 须在筛选中剔除 | 否（覆盖表是派生对照，非契约） | **今天可做** | 按 coverage.md 读法 1 逐行筛出纯测例可补的行（如 00-ask A3「未断言 `answerKind=knowledge`」）补测并把缺口列改写为终态。 |
| 10 | worker metrics 出口 | 无对象（口径已裁不得开）：`prds/12-delivery-guides/14-模块需求功能表.md:34,206`（worker 禁止「对外 HTTP」）· `apps/worker/src/` 无 metrics 模块 · `docs/module-status/worker.md:43,84`（`contextualize_*` 只作日志字段） | 无 | 是 —— 开端口要改功能表禁止列 + ADR；正解已裁定走入库报告（migration `0019`） | **无对象** | — |

## 5 · `pending_review` 的 admin 审阅面

- 为什么可做：功能表 §4.3（`:299`）把「入库报告…`pending_review` 须人工二选一」列为 P1 必达，且**数据面与端点已齐**——报告冲突对 DTO 带 `heldChunkId`（`ingest-report.contract.ts:16`），resolve 端点已冻权限为 `doc.editor`（`routes/documents/index.ts:626-629`，`{winner:'this'|'other'}`、不代跑 reindex）。
- 今天缺的只是 UI 面：`documents-workspace.tsx:1200-1202` 只把冲突渲染成 `冲突 {otherDocId}` 文本，既不显示 `pending_review`，也没有「二选一」控件。
- 要动哪些文件：`apps/admin/src/app/(ops)/documents/_components/documents-workspace.tsx`（报告块）；如需抽纯函数则进 `apps/admin/src/app/(ops)/documents/report.services.ts`（已有 `dedupeRateLabel` / `contextualizeCountsLabel` 同型先例）；测例进 `apps/admin/tests/ops/documents-workspace.test.tsx`（RTL 已就位，jsdom + `@testing-library/user-event`）。
- 风险点：① 报告 DTO 是 `.strict()`，展示层不得自行发明字段；② resolve 的断言口径是「只动两列、不碰对方文档」，UI 不得暗示「已重跑入库」——端点只回 `reindexRequired`；③ 非 `doc.editor` 不得渲染控件（权限码与 PATCH 同码，可用现有 `codes` 判定）。
- 验收方式：RTL 测例——注入一条 `action='pending_review'` + `heldChunkId` 的报告，点击「保留本块」后断言请求打到 `POST /documents/:docId/dedupe-conflicts/:chunkId/resolve`、body `{winner:'this'}`、成功后列表按返回刷新；再用 `winner='other'` 作对照；无权限时不渲染控件。

## 6 · admin 站规清扫（原生 `<select>` → `@strict-rag/ui` 关闭列表）

- 为什么可做：目标组件已在包里且已被**同页混用**（`closed-select.tsx`；`documents-workspace.tsx` 同文件既有 3 处 `ClosedSelect` 又有 7 处原生 `<select>`），站规也已成文（`quality-guidelines.md:106,122` 明写「禁止原生 `<select>`」）。替换是照抄既有用法，不是新设计。
- 计数现状：20 处原生 `<select>`（departments 6 · documents 7 · models 3 · kb/settings 2 · chunk-strategy-panel 1 · eval 1）+ 3 处旧 `Select`（`app/login/page.tsx:8` · `members/_components/members-workspace.tsx:12` · `chunks/_components/chunks-workspace.tsx:12`），与上一图记载一致。
- 要动哪些文件：上述 6 个 workspace 组件 + 3 个 `Select` 使用点；不动 `packages/ui` 组件本身、不动任何 API。
- 风险点：① **视觉回归今天不可验**——仓内无 playwright / 视觉 diff，jsdom 不断言样式；前图（工单 93 / 98 / 103）正因这一条把它连续三批划出，本项若不接受「行为级验收」，结论应改为「被浏览器阻塞」。② 替换会改变 DOM 结构（原生 `<select>` 的 `name`/`onChange(Event)` → `ClosedSelect` 的 `value` 回调），同文件里依赖 `e.target.value` 的 handler 要一起改，漏改会造成静默不回填。③ 批量替换跨 6 个文件，建议按文件独立提交、按文件跑测。
- 验收方式：`pnpm --filter @strict-rag/admin test`（含 RTL）逐文件绿；每个替换点至少一条断言（打开 listbox 的选项文案与值、选择后回填、无权限/空列表态）；全仓 `pnpm check-types` + `pnpm lint`（零 warning）。视觉回归必须在交付说明里显式写「未验证」。

## 7 · `drizzle/meta` 基线缺失

- 附带核对（本次实读）：`packages/db/drizzle/meta/` 物理上**只有两个文件**——`_journal.json`（3329 字节）与 `0000_snapshot.json`（1846 字节）；`packages/db/drizzle/*.sql` 共 **22 个**（`0000_phase0_schema_meta` → `0021_chunks_dedupe_review`，连续无缺号）；`_journal.json` 共 **22 条**（`idx` 0–21，tag 与 `.sql` 文件名逐条相等）。→ **缺 `0001`–`0021` 共 21 份快照**。
- `packages/db/package.json` 的 `db:generate` = `drizzle-kit generate --config drizzle.config.ts`（`package.json:15`，无防护包装、无 `--name`）；`drizzle.config.ts` 的 `out: './drizzle'`、`strict: true`。
- 旧建议文件判断：`research-drizzle-meta-baseline.md` 的**机制结论今天仍成立**（`generate` 只取物理目录排序末位快照 · `migrate` 不读快照 · `check` 对缺快照假绿 · `drizzle-kit@0.31.10` 不输出 `IF NOT EXISTS` · schema↔migration 在列名级零漂移），但报告末尾那条「后记」的编号（19 份 / 基线名 `0019_snapshot.json`）**已再次过期**——本批新增了迁移 `0020_documents_active_index_version` 与 `0021_chunks_dedupe_review`，故基线名应为 **`0021_snapshot.json`**，下一次 `generate` 的新 `idx` 是 **22**。
- 为什么可做：`generate` 不需要连库（`bin.cjs` 取快照只 `readdirSync`），产线只依赖「仓外副本」这一条纪律；不存在外部基础设施前置。
- 要动哪些文件：只新增 `packages/db/drizzle/meta/0021_snapshot.json` 一份；**不动**任何 `.sql`、**不动** `_journal.json`。
- 风险点：① **必须在仓外副本里生成**，副本产出的 `0022_*.sql` 一律丢弃（提交 generate 产物 = 已建表库上 `relation "…" already exists` 中断迁移链）；② 快照来自 schema 视图、实库来自手写 SQL，二者只在**列名级**核对过零漂移，类型 / 默认值 / NOT NULL 未经机器核对 —— 落盘前应先做一次人工走查（26 表 350 列 + 10 索引，规模可控）；③ 文档滞后仍在：`.trellis/spec/db/backend/database-guidelines.md:193` 写「`0001`–`0019` 共 19 份」，`docs/module-status/db.md:52` 已写 `0001`–`0021`，两处口径不一致，回写时一并纠正。
- 验收方式：仓内 `npx drizzle-kit generate --config packages/db/drizzle.config.ts` 打印 **`No schema changes, nothing to migrate 😴`**（唯一硬指标；打印出任何 `CREATE TABLE` 即失败）；`git status --porcelain packages/db/drizzle` 只应看到那一份新增未跟踪文件；`drizzle-kit check` 可跑但**不得单独用作验收**（对本债假绿）。

## 9 · 覆盖表 P2 必签「部分测」余量

- 为什么可做：表本身给了可执行读法——`coverage.md:13`「默认只扫 **P2 必签** 且覆盖为 `缺测` / `部分测` 的行，那是下一批补测清单」，`:82` 已指定顺序「先信任环 A/D/F/H/K/U → 入库闸 L/M/V → 运营壳」；每行的「缺口」列已写清缺哪条 Then（例如 00-ask A3「未断言 `answerKind=knowledge`、非成员负向 E2E」），补测对象是现成测例文件的增量。
- 计数现状（本次机械计数，可复核）：4 个分册中含「部分测」的行 ≈130，其中同时标 `P2必签` 的 **86 行**：`01-ingest.md` 26 · `02-acl.md` 22 · `03-ops.md` 20 · `00-ask.md` 18。（`.trellis/tasks/08-06-project-backlog/research/coverage-gap-impl.md:46` 里的「114 条」是更早快照，仅作滞后旁的旁证，不作为口径。）
- 要动哪些文件：测例按能力落 `<包>/tests/<能力>/<意图>.test.ts`（文件头「目标 / 简介」简体中文）并登记该包 `tests/index.md`；改完后同步 `docs/testing/coverage/<分册>.md` 的覆盖值与缺口列，必要时同步 `coverage.md:57` 的分册计数表。
- 风险点：① 这批是**混合批**——部分行的「缺口」本身就指向真 ES / 真杀毒 / 真网关（如 `01-ingest.md:14,27` 明写「默认 `RETRIEVE_ES_MODE=mock`，≠ 生产 ES」），这些行属被外部依赖阻塞，**不得**为了清零把 mock 结果标成「已测」；② 覆盖表是派生物，改表不得抬 `docs/module-status` 成熟度，也不得改写剧本原文；③ 禁止按源码一对一镜像造测例。
- 验收方式：先出一张「可离线补 / 须留阻塞（附阻塞方出处）」两栏清单（这正是本图另一张研究票的活），再按信任环顺序补；每补一批跑相关包 `pnpm test` + 全仓 `pnpm check-types` / `pnpm lint`，并确认被改行的覆盖值只剩「已测」或「延后 / UAT（附出处）」两种终态。
