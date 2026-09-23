# 落地：ingest 分册两行（M8 · V5）

Type: task
Status: claimed（主控 2026-09-23 认领；实现子代理执行）
Blocked by: 02-dec-per-row-ruling

## Question

按工单 02 的裁定，把 ingest 分册这两行收口到位：

- `M8`（infected 删除后：RustFS 无残留；无隔离区；审计含 hash + uploaderId + timestamp）
- `V5`（admin reject：不 scan；可重提）

落地范围（以工单 02 裁定为准）：

1. **`M8` 的「对象已删」半截**：可在离线断言（`apps/worker/src/ingest/object-store.ts` `deleteObject` + `pipeline.ts` MALWARE 路径）→ 若裁定为可离线，补一条**专断言**（别让它只作为 `scan-infected-effects.test.ts` 的副产品），并写明「无残留 / 无隔离区」在 mock 存储下的可核对边界。
2. **`M8` 的「审计含 hash + uploaderId + timestamp」半截**：源码无落点 → 按裁定走「补审计面（若离线可做且属加严）」或「记债 + 写明阻塞方」。若补面，落点必须在 `apps/worker`，且**不许**把「阶段账本里已有 `failed` 行」冒充成该审计面。
3. **`V5` 的「可重提」半截**：`rejected → pending` 今天无端点。若裁定为「源码缺实现且离线可做」，加端点必须是**加严**（原来不可重提 → 现在只能由有权者重提，且重提后仍不自动入队 scan）；若裁定为「PRD 未定义端点、须先裁契约」，写清归属并记债，**不新增端点**。
4. **覆盖表**：`docs/testing/coverage/01-ingest.md` 这两行的「缺口」列按统一写法改写，覆盖值按裁定重判。

纪律：

- **不许**改 `prds/*`；**不许**改 `fixtures/*`（本图不扩集）；**不许**动 `INGEST_ES_MODE` / `INGEST_SCAN_MODE` 等默认值。
- **不许**把 mock 结果说成真实现（`M8` 的真杀毒属 QUAL-2，已划出）。
- 若新增端点，必须同时补 `packages/contracts` 侧错误码 / DTO（若有）与 HTTP 测例，并在收口报告里**显式声明新增了端点**。
- 收尾跑 `pnpm check-types` + `pnpm lint` + `pnpm run test --filter @strict-rag/api --filter @strict-rag/worker`。

## 产出

- 源码 / 测例 / 覆盖表改动（可提交的 diff）。
- 本工单 `## Answer`：两行逐行的「收口动作 → 文件 → 证据」+ 反证记录。

## Answer

**M8（甲 · 审计面）**

- 收口动作 → 在 worker 包新增专断言测例（未删 / 未改既有 `it` 及其期望值；复用 `tests/ingest/_support/ingest-harness.ts` 的注入方式，另加「存活对象键集合」透镜以断言「不再存在」）。
- 文件 / it：`apps/worker/tests/ingest/scan-infected-no-residue.test.ts:74` `M8：infected 处置后对象已删且不再存在，且无第二落点（无隔离区键）`（`deleteObject` 恰一次且键 = 原对象键；删后键不存在、无任何第二键）；同文件 `:88` `M8 静态守卫：worker 源码无 quarantine 隔离区落点，object-store 变更面只有 deleteObject`（`src/` 全树无 `quarantine｜putObject｜copyObject｜moveObject｜storeObject`；`object-store.ts` 导出函数集恰为 `deleteObject/readObjectBytes/readObjectText/storeConfigFromEnv`）。
- 登记：`apps/worker/tests/index.md` 新增一行（存货闸 `scripts/check-test-inventory.mjs` 已过，`# fail 0`）。
- 覆盖表：`docs/testing/coverage/01-ingest.md:50` 缺口列改为统一定型写法「已裁定：甲 · 依据 PRD（`03-acceptance-scenarios.md:208` + `09-security…:358` / ADR-038 #4）+ 源码锚点（`pipeline.ts:307-318`、`object-store.ts:79-95`）· 收口〈已落地 it 名 ｜ 阻塞方 + 销账条件〉」，覆盖值仍 `部分测`；顺手订正转述错锚点 `apps/api/src/routes/documents/index.ts:361` → `:352`（`:361` 是 `status: 'uploaded'`）。

**V5（甲 · 重提端点）**

- 收口动作 → 只订正覆盖表口径，另补一条离线可断言 `it`（**未新增任何端点**）。
- 文件 / it：`apps/api/tests/ingest/reject-http.test.ts:129` `V5 边界：rejected 再 reject 幂等 200 且不写库（无回 pending 的重提路径）；非 pending → RULE_VIOLATION`（既有 `:85` / `:105` 两例未动）。
- 覆盖表：`docs/testing/coverage/01-ingest.md:83` 缺口列同法定型（依据 `03-acceptance-scenarios.md:380` + `routes/documents/index.ts:484-523` / `:525-560`；阻塞方 = PRD 未定义端点契约，销账条件 = 先裁端点契约），覆盖值仍 `部分测`；本分册按覆盖值的小计未变。

**门禁（原始结果）**：`pnpm check-types` → `Tasks: 8 successful, 8 total`；`pnpm lint` → `Tasks: 8 successful, 8 total`（`--max-warnings 0`）；`pnpm run test --filter @strict-rag/worker --filter @strict-rag/api` → `Tasks: 5 successful, 5 total`，其中 worker `Test Files 56 passed (56)` / `Tests 251 passed (251)`、api `Test Files 177 passed (177)` / `Tests 1099 passed | 3 skipped (1102)`、两包存货闸 `# tests 8 / # fail 0`。

**反证（红 → 还原后绿）**：① 把 `scan-infected-no-residue.test.ts` 的 `expect(liveKeys.has(OBJECT_KEY)).toBe(false)` 改坏为 `true` → `Tests 1 failed | 1 passed`（`AssertionError: expected false to be true`）；② 把 `reject-http.test.ts:129` 的 `toBe('RULE_VIOLATION')` 改坏为 `'FORBIDDEN'` → `Tests 1 failed | 2 passed`（`expected 'RULE_VIOLATION' to be 'FORBIDDEN'`）。两处按原值还原后复跑：两个文件全绿，完整门禁复跑仍 `Tasks: 5 successful, 5 total`（turbo 缓存命中 ⇒ 还原后源码与首轮绿态逐字节一致）——**还原后绿**。

**不做项（守住）**：未实现审计面（未拿阶段账本 `failed` 行冒充 `hash + uploaderId + timestamp`）；未新增 `rejected → pending` 重提端点；未改 `prds/`、`fixtures/`、任何默认开关；未删既有 `it`、未改其期望值。
