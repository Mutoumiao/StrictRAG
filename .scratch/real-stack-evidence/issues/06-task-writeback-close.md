# 回写与收口（覆盖表 / module-status / spec / 雾重排）

Label: wayfinder:task
Type: task
Status: resolved
Blocked by: 04, 05

## Question

把工单 02–05 真跑得到的结论回写到正确的地方，并收口本图：

1. **`docs/module-status/`**：把「真栈未验证」相关的句子改成**实测结论**（含证据路径）；`docs/ops/operable-stack.md`、`docs/ops/half-smoke.md` 里与实测不符的句子订正（**只允许加证据或订正**，不许放宽）；遵守镜像纪律：正文**不写 `路径:行号`**、不给裸标识符加反引号。
2. **`docs/testing/coverage/`**：把工单 05 逐条裁定的行（至少 `X5`，及工单 01 核出的其它「真 ES / 真 PG 阻塞」行）改判或把销账条件写准，并附真跑证据路径。判据以 PRD 原文措辞为准；**不许**为了让某行变绿去放宽断言。
3. **`.trellis/spec/`**：真跑暴露的「真实运行时行为 vs spec 描述」差异，回写对应包 spec（HOW）。
4. **雾重排**：更新 `.scratch/fog-inventory-2026-09-23.md` 里被本图解掉 / 收窄的簇（23 · 24 · 36 · 37），并把本图 `Not yet specified` 里新暴露的雾搬过去或立成下一张图的候选。
5. **收口门禁**：最后一次提交**之后**跑 `pnpm check:module-status`（`1-路径` / `6-联动` / `7-时效` 三类须为空）+ `pnpm check-types` + `pnpm lint` + 全仓 `pnpm test --concurrency=1`，把命令与结果写进本票 Answer。
6. 更新本图 `map.md`：Destination 达成情况写清（**哪些真跑了、哪些没跑成及为什么**）、Decisions-so-far 补全、前沿清空或如实留票。

产物：本票 Answer + 各处回写的 commit。

## Answer

**已收口**。

**回写清单**（全部只加证据或订正，无放宽）：

| 落点 | 改了什么 |
|------|----------|
| `docs/ops/operable-stack.md` | ① 补「**全新库必须配 `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`**，否则 api 必然起不来」（此前四份运维文档全未写）；② 订正 `/ready` 期望：s3 只在**首次 put 建桶后**才 up，`gateway` 未配为 `skipped`；③ 头部链接新增的真跑证据文 |
| `docs/ops/half-smoke.md` | 步骤表第 5 步写清 ADR-048 #4 四眼（自审必 403 + 换主体审批）；前置补超管引导 |
| `docs/ops/real-stack-evidence.md` | **新增**：复现命令 + 真跑观测（五服务 / 探活 / `/ready` / 迁移 23=23=23 / 端到端入库 / 真 ES 检索与 ACL 三态）+ 两处修复 + ask 段三契约边界 |
| `docs/module-status/worker.md` | es_index 段补 `refresh=wait_for` 事实；「最近更新」加 2026-09-29 真跑条目；「真实 ES + IK 索引」债条更新为「IK 非命中必要条件」；「可跑通」口径扩到真栈 |
| `docs/module-status/README.md` | 能力矩阵半产品段补真栈复核三点结论 |
| `docs/testing/coverage/01-ingest.md` | **E1** 缺口列改判：阻塞方由「真 ES 部署」改为「仓内可重复的真 ES 集成测位」（覆盖值仍 `部分测`） |
| `docs/testing/coverage/02-acl.md` | **X5** 缺口列改判：阻塞方**不是环境**而是**源码缺面**；并写明该缺失**不构成泄漏**（语料求交）、代价是召回（覆盖值仍 `部分测`） |
| `docs/testing/coverage.md` | 新增**第十轮**记录；末段「不可离线补的阻塞行」为 E1 加注 |
| `.scratch/fog-inventory-2026-09-23.md` | 追加 2026-09-29 动向；簇 **23 改判已解** · **24 改判部分解** · **37 阻塞方精确化** · **新增簇 39**（半产品问答段的可复现性 = 产品决定） |
| `apps/worker/tests/index.md` | 登记新测例 `ingest/es-bulk-refresh-before-reconcile.test.ts` |

**覆盖值与判据来源一律未动**：PRD 的 Then 措辞与门限一个字未改；`prds/00–11` 一个字未改；仓库默认开关（`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / 扫描 / OCR）一律未动。

**收口门禁（最后一次提交之后复跑）**：

| 门 | 结果 |
|----|------|
| `node scripts/module-status/check.mjs` | **39 条**（与前图基线 **39 = 2 env + 13 符号 + 24 表** 完全一致，未新增漂移；`1-路径` / `6-联动` / `7-时效` 三类为空） |
| `pnpm check-types` | 8/8 tasks successful |
| `pnpm lint` | 8/8 tasks successful（零 warning） |
| `pnpm run test --concurrency=1` | 11/11 tasks successful；api 177 文件 / 1099 通过（3 skipped） |
| `pnpm --filter @strict-rag/worker test` | 57 文件 / 253 通过 |

**提交（全部本地，未 push）**：`e2100c9` fix(worker) · `b1cd4c8` fix(scripts) · `3e25342` chore(wayfinder 图产物) · `c75069e` docs(ops,eval) · `4b9aa79` docs(module-status)。

**未做（如实）**：不改 `docker/docker-compose.yml`（五个镜像已在本机、无需改动）；不建 dev-only 桩 Gateway（属产品决定，见簇 39）；不代签、不把 mock 当 live。
