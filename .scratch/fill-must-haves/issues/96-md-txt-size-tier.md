# MD/TXT 更严体积档最小闭环

Type: task
Label: wayfinder:task
Status: pending
Assignee: —
Triage: ready-for-agent
Blocked by: 95

## Question

补上传体积闸的**按类型族更严档**。

权威：

- 功能表 §5.2（第 363 行）：「complete 权威校验 size/MIME/checksum；默认 50 MiB、天花板 200 MiB（**MD/TXT 可更严**）」
- 功能表 §6（第 471 行）：「文件硬上限：默认 50 MiB / 文件，天花板 200 MiB；**MD/TXT 可更严**。权威闸在 complete Head 对象，禁止只认 key 存在。」
- `prds/09-security/01-auth-acl-compliance.md` §7：「单文件大小 ｜ 1–2 ｜ 默认 50 MiB；可配；硬天花板 200 MiB；**可选 MD/TXT 更严（建议 10 MiB）**」；「权威 size 闸 ｜ `complete` Head 对象…**同一配置源**」
- `prds/05-api/01-http-api-hono.md` §2.3:203-208：「实际 size ≤ `INGEST_MAX_FILE_BYTES`（默认 50 MiB，≤ 天花板 200 MiB）」
- 审查报告 `prds/12-delivery-guides/14-模块需求功能表-审查报告.md:167` 把该行列为 **P1 缺口**。

现状（源码 IS）：

- 单一上限：`apps/api/src/env.ts:67-69`（`INGEST_MAX_FILE_BYTES` 默认 52_428_800 / `…_CEILING` 默认 209_715_200）；`:176-183` 越天花板拒启动；`apps/api/src/services/storage.ts:246-248` `effectiveMaxUploadBytes() = min(两者)`；闸函数 `apps/api/src/gates/upload-size.ts:5-12`。
- complete 权威路径：`apps/api/src/services/ingest-complete-pending.ts:169-199`（`headObject` 存在性 + `checkUploadMedia` + `checkUploadByteSize`）；write 路径同闸在 `:60-78`。
- MIME 白名单已落：`packages/contracts/src/ingest/upload-media.ts:6-17` / `:46-55` `isAllowedIngestMedia` / `:58-72` `resolveIngestContentType`；闸壳 `apps/api/src/gates/upload-media.ts:1-11`。
- **无族级上限**：`checkUploadByteSize(head.byteSize, max)` 只有单一 `max`；env 无族级变量；admin 上传侧 `apps/web`/`apps/admin` 亦按通用上限提示。

口径（本票执行时须在 Answer 复述，并按 PRD 原文裁决默认值）：

- 新增族级上限 env（如 `INGEST_MAX_TEXT_FILE_BYTES`），**默认取 PRD §7 建议值 10 MiB** —— 依据：审查报告把「MD/TXT 可更严」列为 P1 缺口，若默认留空则该缺口实际未闭合。**这属行为变更**（MD/TXT 从 50 MiB 收紧到 10 MiB），必须在 spec 与 `docs/module-status/api.md` 写明。
- 生效值 = `min(通用上限, 族级上限, 天花板)`；族判定复用 `resolveIngestContentType`（**同一配置源**，禁止另起一套扩展名表）。
- 超限仍是 **413 `PAYLOAD_TOO_LARGE`**（ADR-039），错误文案须能看出命中的是哪一档。
- env 校验：族级 > 通用或族级 > 天花板 → 启动即拒（与 `:176-183` 同风格）。

### 做

- `env.ts` 加族级上限 + 默认值 + 越界校验；`gates/upload-size.ts` 增按族取档（或新增同层纯函数，保持可单测）；`ingest-complete-pending.ts` 的 complete 与 write 两条路径都走族级档（**不得**只改一条）。
- 上传侧提示（web/admin upload-url 响应的 `maxBytes`，PRD §2.3:198 明确它是纵深、非权威）如实反映族级上限。
- 测例：`apps/api/tests/ingest/complete-size.test.ts`（扩族级用例：MD/TXT 超 10 MiB 拒、PDF 同尺寸仍过）· `complete-media.test.ts` · `apps/api/tests/env/defaults.test.ts`（新 env 默认值与越界拒启动）。禁真对象存储（沿用现有 storage 夹具）。

### 不做

- **不做文件魔数（magic number）嗅探**：功能表与 `prds/00–11` 均无此要求（全仓 grep 零命中；契约测例口径原本就写「不嗅魔数」）。它属加固而非必达；若将来要做须显式标注来源另开票。
- 不引真杀毒 / 扫描引擎（QUAL-2 仍在债表，真引擎选型锁死）；不改 MIME 白名单集合；不松「未审批就 scan」；不改 complete 的 checksum 与对象存在性语义。
- 不改 `prds/00–11`；不 `task.py create`；禁止 push。

收工：`.trellis/spec/api/backend/` 上传 / env 相关节 + `docs/module-status/{api,web,admin}.md`（默认值变更与「未做魔数嗅探」要写明）。Answer 里写明默认值决策依据与「魔数嗅探显式未做」。

## Comments

- 2026-09-16 由 [裁定 93](./93-after-92-order.md) 排为本批第三张。注意：本票**不动**默认关的任何强制开关，也不把嗅探塞进来。
