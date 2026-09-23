# 落地：ops 分册四行（R9 · T6 · P3 · AC2）

Type: task
Status: claimed（主控 2026-09-24 认领；实现子代理执行）
Blocked by: 02-dec-per-row-ruling

## Question

按工单 02 的裁定，把 ops 分册这四行收口到位：

- `R9`（ask 调用 `plane=ask`；**入库 embed `plane=ingest`**；purpose 可区分）
- `T6`（KB 快照 = 已签字包；篡改 → **加载拒绝**）
- `P3`（verify 仅 `judge`；抽样仅 `judge_aux`）
- `AC2`（llm + embedding + rerank 各至少一启用 → **可保存**）

落地范围（以工单 02 裁定为准）：

1. **`R9`**：`apps/worker/src` 全仓零处 `plane`（worker 入库 embed 链无打点）。若裁定为「源码缺实现且离线可做」→ 在 worker 侧补 `plane=ingest` 打点**且属加严**（原先无打点 → 现在有；不得改变既有指标语义与预算口径）；补测例证明 worker embed 调用带 `plane=ingest`。若裁定为「须先裁计数口径 / 撞 embed TPM」→ 记债并写明阻塞方（`prds/04-pipelines` / ADR-044 线）。
2. **`T6`**：`apps/api/src/eval/adr046-snapshot.ts` 只有写侧 + CLI（唯一消费者 `apps/api/src/scripts/run-l1-golden.ts`），无运行时读取 / 加载入口。**此项撞 ADR-007「`TAU_CLAIM` 唯一源」→ 前图已划为须 ADR**：本票只做「归属写清 + ADR-ready 裁定书 + 覆盖表缺口列改写」，**不许**自己发明一个运行时加载口。
3. **`P3`**：`BindingPurpose` 含 `judge_aux`，但调用侧 `ChatPurpose` 不含（`apps/api/src/services/gateway/resolve.ts:7`），且全仓无 online_sample 抽样链。按裁定走「补调用侧面（须先有抽样链，可能超出本图）」或「记债 + 归属写清」。**不许**把 `BindingPurpose` 的 `judge_aux` 说成「调用侧已具备」。
4. **`AC2`**：`validatePlatformBindings` 无「三类各至少一」闸，而 Then 字面只要求「**可保存**」。按裁定走「订正覆盖表口径 + 补专断言钉住『可写入三类并绑定』」或「加严补闸」。若加严补闸，**必须**先核 PRD 是否真要求（引用原文），并确认不会打红既有 `apps/api/tests/gateway/bindings-http.test.ts`；打红了就要逐条判，不许直接改断言。
5. **覆盖表**：`docs/testing/coverage/03-ops.md` 这四行的「缺口」列按统一写法改写，覆盖值按裁定重判；该册的行数合计与 `docs/testing/coverage.md` 的汇总表**必须用脚本按行求和核一遍**（前图手工加式写错过一次）。

纪律：

- **不许**改 `prds/*`（含 §6.0）；**不许**动 `RETRIEVE_ES_MODE` 等默认开关。
- **不许**把「写侧有 + CLI 有」说成「运行时已绑」；**不许**把「函数在」说成「线已接」。
- 收尾跑 `pnpm check-types` + `pnpm lint` + `pnpm run test --filter @strict-rag/api --filter @strict-rag/worker`。

## 产出

- 源码 / 测例 / 覆盖表改动（可提交的 diff）。
- 本工单 `## Answer`：四行逐行的「收口动作 → 文件 → 证据」+ 反证记录 + （若改覆盖表合计）脚本核对输出的证据。

## Answer

**改动画（仅 `docs/testing/coverage/03-ops.md`）**：四行缺口列改定型写法，`AC2` 覆盖值 `部分测` → `已测`；`AC` 子表 7/2 → 8/1、合计 40/19 → 41/18；加式行 + 新增「第七轮」尾注同步。

| 行 | 归属 | 覆盖值 | 缺口列要点 | 依据锚点 |
|---|---|---|---|---|
| `R9` | 甲（源码缺实现） | `部分测`（保留） | 本票不建 worker 指标面；销账 = ① worker 指标面落地 ② 真 Redis / 配额基建（embed TPM） | `03-acceptance-scenarios.md:307` · `apps/api/src/obs/metrics.ts:184-187` · `apps/worker/src` 对 `metric` / `plane` 零命中 |
| `T6` | 丁（撞 ADR-007） | `部分测`（保留） | 本票不发明运行时加载口；销账 = ADR → 改 PRD → 升 `prds/README.md` 版本 | `03-acceptance-scenarios.md:344` · `apps/api/src/eval/adr046-snapshot.ts:265,315` · 唯一消费者 CLI `apps/api/src/scripts/run-l1-golden.ts:769,793` · `routes/kb-settings.ts:61-65` |
| `P3` | 丙（Then 引了源码不存在的面） | `部分测`（保留） | 不把 `judge_aux` 加进 `ChatPurpose`；销账 = `online_sample` 抽样链落地（新功能） | `03-acceptance-scenarios.md:260` · `model-gateway.contract.ts:38`（`BindingPurpose`）· `services/gateway/resolve.ts:6-12`（`ChatPurpose`）|
| `AC2` | 乙（字面义务已满足） | `部分测` → **`已测`** | 不加「三类各至少一」闸（非 PRD 要求） | `03-acceptance-scenarios.md:479` · `prds/05-api/01-http-api-hono.md:465` · `services/model-gateway.ts:176-211` |

**脚本核（node 临时脚本读本册：按行统计覆盖值 → 与声明小计逐格比对 → 加式逐项求值比对）**：

```text
合计 94 行 | 已测 41 | 部分测 18 | 缺测 0 | 缺实现 3 | 延后 23 | UAT 9
声明小计表 vs 实际：全部一致（11 子表 × 7 列 + 合计 7 列）
已测   式=1+1+1+2+1+6+3+8+8+10+0 求值=41 声明=41 实际=41 逐项对齐=是 ✓
部分测 式=4+2+0+1+2+1+5+0+1+0+2 求值=18 声明=18 实际=18 逐项对齐=是 ✓
缺测/缺实现/延后/UAT 四式：求值=声明=实际 且逐项对齐=是 ✓；行数 声明=94 实际=94 ✓
【总体】一致：0 处不一致（exit 0）
```

**反证**：把 `AC2` 覆盖值临时改回 `部分测` 复跑 → 报逐格不一致（`AC.已测 声明=8 实际=7`、`AC.部分测 8→1` 反向、`合计.已测 41→40`、`合计.部分测 18→19`）+ 加式 `已测`/`部分测` 两式「逐项对齐=否」+ 终值断言 `AC2 期望=已测 实际=部分测`，**共 7 处不一致（exit 1）**；还原为 `已测` 后复跑 → **0 处不一致（exit 0）**，随后门禁全绿：`pnpm check-types` **8/8**（exit 0）· `pnpm lint` exit 0（全包 `--max-warnings 0`）· `pnpm run test --filter @strict-rag/api --filter @strict-rag/worker`（api 177 文件 / 1099 passed + 3 skipped；worker 56 文件 / 251 passed）。注：脚本首跑曾报 60 处不一致，经查是**脚本自身 off-by-one**（误把「步骤数」列切掉），修脚本后全绿 —— 那是脚本 bug，非文档不一致。

**四项不做守住**：`R9` 未建 worker 指标面、未动 `apps/api/src/obs/*`；`T6` 未发明任何运行时加载口 / 告警口；`P3` 未把 `judge_aux` 加进 `ChatPurpose`、未称调用侧已具备；`AC2` 未加「三类各至少一」闸 —— 四项**全部守住**，且全程未改 `prds/`、`fixtures/`、任何默认开关（含 `RETRIEVE_ES_MODE`）与 403 / 码值语义，未删 / 跳过任何既有 `it`。
