# 裁定签字包 gatePackageId / effectiveAt 的数据来源

Type: grilling
Status: open
Blocked by: 02

## Question

前图把「签字包链」（功能表 §4.2）列为前置未解；核查确认**仍然如此**：`defaultQuality()`（`apps/api/src/routes/kb-settings.ts:61-66`）恒写 `gatePackageId: null, effectiveAt: null`，是全仓唯一生产者；真实快照由 `writeBoundSnapshot` 落 `artifacts/l1-gate-snapshot.json`（`apps/api/src/eval/adr046-snapshot.ts:217-227`），并作为 `reportJson` 进 `eval_runs`（`apps/api/src/routes/eval-runs.ts:33-34`），**无任何回填 KB 设置的路径**。

请先钉事实再裁定：

1. **权威 PRD 行**：`gatePackageId` / `effectiveAt` 的字段定义与取值语义（ADR-046 快照、05-api KB 设置、08-quality 门禁包），逐条给行号。
2. **候选来源**：① 由 `eval_runs` 派生（哪一行的哪个字段、怎么选中「当前签字包」）；② 快照落库后回填 KB 设置；③ 继续只落文件、字段保持 null 并在合同上写明「未接」。逐个给代价与风险。
3. **裁定**：选哪条；`effectiveAt` 的取值口径（签字时刻 / 快照生成时刻 / 生效时刻）；回填时机与幂等要求。
4. **范围**：本图只做**数据来源的表示与回填**（工程侧），**不做**业务人签。请明确写出「做到哪一步」与「人签仍缺什么」。

答案须落到可编码精度；若结论是「本图不实现、只钉表示」，也须明确写出并说明它是否仍算本图缺口。

## Answer

<!-- 解析时写 -->
