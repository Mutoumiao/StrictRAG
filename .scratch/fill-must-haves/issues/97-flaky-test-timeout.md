# api 脆弱测例超时热修最小闭环

Type: task
Label: wayfinder:task
Status: resolved
Assignee: grok
Blocked by: —

## Question

`pnpm test` 全量跑里间歇红一条，来源是「**测试体内** `await import(重模块)`」的用例在并行 worker 抢 CPU 时越过 vitest 默认 `testTimeout: 5000`。

证据（本轮多次实测）：

| 用例 | 单跑实测 | 全量跑出现 |
|------|----------|------------|
| `tests/acl/kb-member-gate.test.ts > POST members without auth → 401`（体内 `await import('../../src/app.js')`） | 3.06s | 多次 `Test timed out in 5000ms`（最高实测 6278ms） |
| `tests/obs/tracer.test.ts > chitchat 路径留下 route+finalize`（体内 `await import('../../src/services/ask/execute.js')`） | 1.49s | 一次超时 |

已用 `git stash`（含未跟踪）在**改动前基线**上对照：基线 `--filter api test` 单跑同样只有 `kb-member-gate` 超时 → **不是某张工单引入**，是既有测例结构问题：收集期的 `await import` 只算收集时间，而**写在 `it()` 体内的** `await import` 计在**用例超时**里。全仓 `tests/**` 共 38 处 `await import`，其中体内调用 6 处，落在 3 个文件：`acl/kb-member-gate.test.ts`(2) · `obs/tracer.test.ts`(5) · `ask/http-stream.test.ts`(3)。

口径：这是**抖动**不是功能失败 —— 不得靠删断言 / 改 mock / 跳过用例「变绿」；只调整超时预算并留下理由。

### 做

- 在 `apps/api/vitest.config.ts` 显式设 `testTimeout`（20s 量级）并写清理由（本包含体内动态导入重模块的集成式用例，默认 5s 在并行负载下会抖）。
- 复核 `apps/api/tests/index.md` 是否需要在「能力」表补一句口径（若无需改则说明理由）。
- 用至少两次全量 `pnpm --filter @strict-rag/api test` 复跑确认不再出现超时；若仍抖，记录实测秒数再调。

### 不做

- 不改任何用例的断言 / mock / 覆盖；不 `skip` / `todo` 化；不动其它包的超时。
- 不把「超时红」当成功能缺陷去改源码；不碰检索闸 / 门禁 / 默认开关。
- 不改 `prds/00–11`；不 `task.py create`；禁止 push。

收工：`.trellis/spec/guides/testing.md` 或 `.trellis/spec/api/backend/quality-guidelines.md` 里记一条「体内动态导入用例的超时预算」口径（择一并说明），`docs/module-status/api.md` 若涉「技术债」行则同步。

## Answer

**诊断**：抖动的不是某个功能，而是「**测试体内** `await import(重模块)`」这一类用例。收集期的同类导入只算收集时间，而写在 `it()` 体内的导入计在**用例超时**里；全量跑并行 worker 抢 CPU 时，`tests/acl/kb-member-gate.test.ts` 的 `await import('../../src/app.js')` 实测冲到 6278ms，越过 vitest 默认 5000ms。全仓 `tests/**` 共 38 处 `await import`，其中体内调用 6 处，落在 3 个文件（`acl/kb-member-gate`(2) · `obs/tracer`(5) · `ask/http-stream`(3)）。

**做了什么**：`apps/api/vitest.config.ts` 显式 `testTimeout: 20_000` + 写清理由（本含集成式用例，默认 5s 在并行负载下会抖；放宽只影响失败暴露时间，不放宽断言）。口径写进 `.trellis/spec/guides/testing.md` §7「基建与运行」表（超时预算一行）。

**没做什么 / 边界**：未动任何断言 / mock / 覆盖，未 `skip`，未改其它包超时，未改源码去「绕过」超时。放宽后真正卡死的用例会在 20s 才失败（不是 5s）——这是本修法的代价，已写进规范。

**验证**：连跑两次 `pnpm --filter @strict-rag/api test` → **两次都 `132 files / 841 passed + 3 skipped`，0 failed，无 `timed out`**。修前同一命令 5 次里红了 3 次（`kb-member-gate` 3 次、`obs/tracer` 1 次）。

## Comments

- 2026-09-16 由地图「回归债（脆弱测例）」升级为工单（本轮全量跑再次被它挡红两次）。属清理债，故在功能批（94/95/96）之间插入执行。
- 2026-09-16 完成：只改超时预算，未碰任何测例内容。
