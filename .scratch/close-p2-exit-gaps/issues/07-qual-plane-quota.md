# QUAL-PLANE：三平面配额 R4–R10

Type: task
Status: resolved
Blocked by: 02

## Question

剧本 R4–R10「三平面配额」。前图 35 只落了 ask / ingest 分 store 固定窗口（默认 0 = 关）+ `plane` 指标 + `ask_quota_exhausted`；`maxEmbedCalls` / embed TPM / staging fail-closed 当时划出。

请逐条补齐 R4–R10 的 DoD（每条对应 PRD 剧本原文行，答案里写清出处）：

1. `maxEmbedCalls` 配置存在时**启动 warning** 且行为 ≡ 无该字段。
2. ask / ingest 配额**互不阻断**（已有能力，补回归钉住）。
3. mock embed 的 **TPM** 口径。
4. **ask 触顶不得 200 空答 `answered`**（按 PRD 原文走拒答或 429）。
5. 指标带 `plane=`。
6. staging 缺配额时 warning + **安全默认**。

约束：不得放宽既有 RPM 闸语义；不得把「进程内全局限流」当作生产方案（见 `docs/ops/rate-limit-and-metrics.md`）；不得把触顶路径写成假 `answered`。

## Answer

### R10（staging/production 缺 plane 配额）—— 已落

- 新增 `apps/api/src/obs/plane-quota.ts`：`SAFE_DEFAULT_PLANE_RPM = 30`（数值取本仓运维文档 `docs/ops/rate-limit-and-metrics.md` §2.1 的试点建议值，**不另发明量级**）· `resolvePlaneQuota(appEnv, configuredRpm)` · `planeQuotasFromEnv(slice)` · `planeQuotas`（进程内决议一次）· `logPlaneQuotaGaps(sink)`。
- **口径**：`>0` 原样生效；`0` 在 dev / test 仍是**关闭**（仓库默认与 CI 行为逐位不变）；`0` 在 staging / production → 回落 `30` 并告警。**非 fail closed**：只调数值与发告警，不做 `exit`。
- **接线**：`apps/api/src/routes/ask.ts` 与 `apps/api/src/routes/documents/index.ts` 的默认限流改读 `planeQuotas.{ask,ingest}.rpm`（与启动告警共用同一份决议，避免各算各的）；`apps/api/src/index.ts` 启动时调 `logPlaneQuotaGaps(logger)`。
- **测**：新增 `apps/api/tests/obs/plane-quota-safe-default.test.ts`（6 条）——dev/test 的 0 仍关；staging/production 的 0 → 30 且 `usedSafeDefault=true`；显式正数不被覆盖；**安全默认确实限流**（第 31 次即失败，不是无限放行）；告警只对回落平面发一次；dev/test 不告警。已登记 `apps/api/tests/index.md`。
- **文档与 spec 同步**：`docs/ops/rate-limit-and-metrics.md`（§2.1 表 + 生效值来源行 + 否决项例外 + 变更记录）· `.trellis/spec/api/backend/ask-pipeline.md`（配额表 + env 表）。
- **未做**：R6（embed TPM）另票 → [核定 embed TPM（R6）的口径](./19-research-embed-tpm.md)；集群配额与 Redis 共享窗口仍是运维文档的既有否决项。
- **门禁**：`pnpm check-types` 8/8 · `pnpm lint` 8/8 零 warning · `pnpm test` 11/11（api **138** 文件 / **884** 通过 + 3 skipped）。

### R4（runtime 出现 `maxEmbedCalls` → warning + 忽略）—— 划出范围

本仓**没有**「runtime 图配置」入口，这条护栏今天没有可挂的对象：

- `graphProfile` / `wallClockMs` 全仓 **0 命中**；档位预算由 `budgetForMode(mode)` 派生（`apps/api/src/graph/budget.ts:9-19`），无 JSON profile 加载器。
- KB 设置写路径是 **strict 白名单**（`packages/contracts/src/kb/kb-settings.contract.ts:109-139`）：未知键 → 400 `VALIDATION_ERROR`，**不**经过「忽略」分支。
- 唯一的运行时预算注入点是 `budgetOverride`，且源码明确标注「单测压预算；**生产勿传**」（`apps/api/src/graph/run.ts:75-76`）—— 在那儿写 detector 就是死代码。

两条替代方案都被否：把 detector 挂在单测钩子上 = 造死代码；把 KB 白名单从「拒未知键」放宽成「warn + 忽略」= **放宽门禁**，与质量红线冲突。

**结论**：R4 属「未来 profile loader 的护栏条款」。当 runtime 图配置 loader 出现时（P3a Full 图 / B8 profile 接入），该 loader 必须实现「含 `maxEmbedCalls` → warning + 忽略」。已记入地图 Out of scope。
