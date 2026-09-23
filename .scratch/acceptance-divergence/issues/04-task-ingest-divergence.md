# 落地：ingest 分册两行（M8 · V5）

Type: task
Status: open
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
