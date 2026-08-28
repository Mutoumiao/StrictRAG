# 策略三层最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Triage: ready-for-agent

## Question

把 ADR-053 分片策略三层从「进程内 catalog + complete/reindex 闸」补成 **可运营的最小闭环**：平台种子表、库启用、上传人选、文档绑定参数快照。这是第二批第一张执行工单（开放前沿；无票名时先做本张）。[文档运营余量最小闭环](./07-document-ops-remainder-min.md) 的 Reindex 人选依赖本张 catalog / `for-upload`。

### 做

- **表**：`chunk_strategy_definitions`（code、适用 `docFamilies`、`paramSchema`、`pipeline_id`、是否已实现）+ `kb_chunk_strategies`（库启用哪些 code、参数覆盖、各 MIME 族 `recommended`）。种子写入 contracts 已知码；**可写 ⊆ `IMPLEMENTED_CHUNK_STRATEGIES`**（现仅 `structure_paragraph`）。roadmap 码可列不可写。新库默认启用已实现码。
- **HTTP**（须 `kb.config.write` 写、读随库设置权限）：列表 / schema / `for-upload` / 库启用 PATCH。权威：功能表 §4.5、§5.2「分片策略」。`for-upload` 按 MIME/检测类型 ∩ 库已启用列出；可用 ≥2 必须人选（默认勾选 recommended）；仅 1 个可自动该套。未选合法码 → 400。写须落库，禁止仍只改进程内 Map。
- **complete**：走上述选择规则；写入 `documents.chunk_strategy` + `chunk_strategy_params` 快照（列已在 schema）。旧文档不因注册表变更自动切换。
- **admin**：知识库设置「分片策略」分区改为弹窗：启用哪些 + 各 MIME 族 recommended。上传表单从 `for-upload` 拉人选，禁止再写死 `structure_paragraph`。改库配置 **不** 自动全库 reindex。
- 进程内 `services/chunk-strategies.ts` 改为读表（可启动种子），写入闸仍对齐 contracts `IMPLEMENTED_*`。
- **测例**：api 选择规则（仅 1 个自动 / ≥2 未选 400 / 未实现 400）；admin 设置启用 + 上传下拉。覆盖表若写「无 recommended / 无参数快照」则改成与源码一致的镜像（不是改 `prds/00–11`）。
- 收工：skill `update-module-status`；`.trellis/tasks/08-06-project-backlog/` **只留指针和勾选**，禁止再 `task.py create`。

写代码前读 `.trellis/spec/` 对应包（api / admin / contracts / db）。权威：功能表 §4.5；HOW 见 `.trellis/spec/api/backend/chunk-strategies.md`（本工单后回写「表为权威」）。

### 明确不做

- 平台注册表运营 CRUD 页（运营扩展任意新 code）
- 按 `paramSchema` 做成完整动态表单引擎（含 `contextMode` L0/L1 控件）
- worker 新切块算法（`fixed_window` / `heading_sections` 仍不可写）
- `pdf_ocr` 偷开 OCR 引擎（P5）
- 改库配置自动全库 reindex
- 策略写审计查询面
- Reindex 列表按钮（下一张）
- 评测、ask 审计、web 消费、检索补钉

## Answer

策略三层最小闭环已落地。

- **表**：`chunk_strategy_definitions` + `kb_chunk_strategies`（migration `0009`）；种子写入 contracts 已知码；可写 ⊆ `IMPLEMENTED_*`（仅 `structure_paragraph`）。
- **HTTP**：列表 / schema / for-upload / 库启用 PATCH。for-upload 按 MIME 族 ∩ 库启用 ∩ 已实现；仅 1 个 `autoCode`；≥2 `requireExplicit`。
- **complete / reindex**：走 available 计数；写入策略码 + `chunk_strategy_params` 快照。旧文档不因注册表变更自动切换。
- **admin**：设置弹窗启用 + 各 MIME 族 recommended；上传走 for-upload，不再写死默认码。改库配置不自动 reindex。
- **测例**：contracts / db schema；api 绑定规则 + complete 自动/快照 + catalog HTTP 403；admin 弹窗与 pickUpload。覆盖 AA2/AA7 改为已测镜像。
- **08-06**：只补指针。未 `task.py create`。

未做：平台 CRUD 页、动态 paramSchema 引擎、新算法、OCR、自动全库 reindex、策略审计查询面、Reindex 列表按钮。

## Comments

- 2026-08-28 按图顺序认领本工单并执行。不开启文档运营余量最小闭环。
- 2026-08-28 落盘如上。
