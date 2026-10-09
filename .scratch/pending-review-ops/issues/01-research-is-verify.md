# 现状核实：`pending_review` 全链 + `ingest_jobs` 运营可见面

Type: research
Status: resolved

## Question

把「跨文档近重复待审」这条链在 **HEAD** 上的真实形状一次核清，供工单 02 裁定。逐条给**源码出处**（路径:行号）与**实测命令**：

1. **落库**：`chunks.dedupe_status` / `duplicate_of` 的写入点（worker 侧）在哪？取值域？（迁移编号？）
2. **报告**：`ingest_reports.conflict_pairs` 的形状与写入条件；`pending_review` 项是否必带 `heldChunkId`？报告怎么被读出（api DTO？admin 面？）。
3. **端点**：`POST /documents/:docId/dedupe-conflicts/:chunkId/resolve` 的权限码、成员闸姿态、body、返回（含 `reindexRequired` 语义）；**是否存在**「列出待审冲突」的读端点（api / contracts）？
4. **发现路径**：今天运营**唯一**能得知「某文档有 pending_review 块」的途径是什么？（报告页？文档详情？文档列表列？）逐条核 admin 源码。
5. **权限与审计**：处置动作是否有审计（Pino / 落表）？`doc.editor` 之外有没有别的闸？`AUTH_ENFORCE` 关时行为？
6. **镜像口径**：`docs/module-status/{admin,api,worker,db}.md` 与 `docs/testing/coverage/03-ops.md` 里凡写「无审阅面 / 无查询面 / 无自动处置」的行，逐条抄原文并标注与源码是否一致（**特别**：`GET …/ingest-jobs` 只读 API 是否已落、镜像是否仍写「无查询面」）。
7. **相邻**：`GET …/ingest-jobs` 的权限码 / 暴露面（成员即可读全量账本？）。
8. **测例存货**：既有测例覆盖到哪一步（`tests/` 与 `tests/index.md` 登记）。

产物：`.scratch/pending-review-ops/research/01-is-verify.md`。硬约束：**只读**，不改任何文件；每条结论带路径:行号或命令输出。
