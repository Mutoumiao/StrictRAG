# Phase 3b 出口的工程侧闭合（文档级 ACL + 部门强制可见）

Label: wayfinder:map
Status: open

## Destination

让路线图 Phase 3b 的出口「**B2 + AE（强制段）绿**」（`prds/10-delivery/01-phased-roadmap.md:199-209`）在本分支达到**工程侧可核对闭合** —— 即在不接真 ES 集群、不改仓库默认开关、无业务签字的条件下，下列五件事都能在源码与测例上指出证据：

1. **「列表预览 / chunk 查看 / ask evidence 同一可见性函数」真收敛**（ADR-057 `prds/11-decisions/00-adr-index.md:1867`）。今天是五份各写一遍的组装：文档列表 `apps/api/src/routes/documents/index.ts:157-190` · 详情/ACL 的 `docReadDenied` 同文件 `:818-860` · 分片预览 `apps/api/src/routes/chunks.ts:61-105` · ask 语料装载 `apps/api/src/services/retrieve/corpus.ts:76-98` · 近似拷贝 `hasRetrievableDocs` 同文件 `:150-182`。收敛后行为须逐位不变。
2. **dense ∥ ES 对称有结论**（ADR-009 `prds/11-decisions/00-adr-index.md:152`）。`buildAclFilter` 只在 ES 稀疏路被调用（`apps/api/src/services/retrieve/es-sparse.ts:234`）；dense 是进程内余弦、输入即 PG 语料（`apps/api/src/services/retrieve/retrieve.ts:163-170`），字面上没「共用 `buildAclFilter(ctx)`」。要么补落点，要么留一条**可核对的裁定**说明等价形态与代价。
3. **ES 查询期与 PG 谓词对称**：ES mapping 无 `visibilityLevel`（`es-sparse.ts:53-61`；ES PRD `prds/03-data/03-elasticsearch-bm25.md:75-77`、`:119` 要求级别比较）；缺 `ownerDeptId` 时 bulk 不写字段（`es-sparse.ts:89-90`），而 PG 语义是「无 owner_dept_id = 库内成员可见」（ADR-057 `:1856`）→ 开强制时库级文档丢稀疏召回。
4. **剧本 B2-1…B2-4 与 AE4–AE12 有自动化断言**（含负向 / 反证），且在**显式开启强制**的配置下跑，不靠人签。
5. **ACL 收紧 → 索引一致性**有裁定与落点：今天 PUT 收紧只回 `reindexRequired` + 日志（`apps/api/src/routes/documents/index.ts:911-928`），不入队。

到达时：`pnpm check-types` / `pnpm lint` / `pnpm test` 全绿；`docs/module-status/`（api · worker · db）与 `docs/testing/coverage/02-acl.md` 按源码回写；`docs/testing/coverage/02-acl.md:160` 的「非本阶段」一行只剩**真 ES 集群验证**、**人签**与**明确的 ADR 债**，不再有工程可做的余项。

## Notes

- 域：StrictRAG。WHAT 冲突以 `prds/00–11` 为准；路线图 = `prds/10-delivery/01-phased-roadmap.md`；剧本原文 = `prds/10-delivery/03-acceptance-scenarios.md`（B2 段 `:49-58` · AE 段 `:509-530`）。IS 以源码为准，`docs/module-status/` 是镜像，`docs/testing/coverage/` 是派生对照。
- **前图**：`close-p2-exit-gaps`（P2 出口工程缺口已清零）。本图是 P2 之后的第一个**独立产品出口**：路线图 `:180` 明写「P3b（doc_acl）**不经**本硬门，可在 P2 之后并行推进」。
- **每轮先读**：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · `docs/testing/coverage/02-acl.md` · 相关包 `docs/module-status/<包>.md`。写代码前读 `.trellis/spec/` 对应包。
- **本图携带执行**：工单可以直接写代码补缺口，不只锁决策。同一缺口禁止再 `task.py create` 平行实现任务。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint` + 相关包测试；收口批次跑全仓 `pnpm test`。新测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头目标/需求/被测/简介用简体中文，并登记该包 `tests/index.md`。
- **站规（UI）**：web / admin 禁止浏览器原生 `<select>`，必须走 `@strict-rag/ui` 关闭列表。本图预计不新增 UI。
- **质量红线不放宽**：检索→约束生成→验证→拒答；min 否决；合法 draft 必 verify；历史≠evidence；**门禁只加严不放宽**（ADR-046）；双就绪∧active 检索闸。本图所有改动必须是**收紧或逐位等价**。
- **不改仓库默认开关**：`DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `AUTH_ENFORCE` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR / `INGEST_CONTEXTUALIZE_MODE` 的默认值一律不动。AE 强制段靠 **KB 覆盖（`config_json.deptAclEnforce`）或测例内 env 注入**达成（`apps/api/src/env.ts:108-113` 注释「禁止默认 true」；`docs/ops/operable-stack.md:73` 把「仓库默认开」列为明确不是项）。
- **不改 `prds/00–11`**：任何「与 PRD 字面不一致」只能以「源码收紧 + 记 ADR 债」收口；销账须 ADR → 改 PRD → 升版本。
- **写回纪律（前图教训）**：`docs/module-status/*.md` 正文**不写 `路径:行号`**（会触发 `pnpm check:module-status` 的 `1-路径` 误报），也不给裸枚举字面量加反引号（会把 `5-表` 告警刷高）。行号只写在 `.scratch/` 工单与 `.trellis/spec/` 里。
- **已知前置（未验证项）**：本机 Docker daemon 未运行 → 迁移无法对真 PG 验证；此类未验证须显式写在工单 Answer 与回写里。

## Decisions so far

<!-- 每关闭一张工单追加一行：名称（链接）+ 一行要点 -->

## Not yet specified

- **角色 principal 是否属 P3b 必达**：ADR-057 `:1861-1864` 给的主体形态是 `user:{id}` / `dept:{deptId}:lv:{effectiveLevel}`，而 `aclPrincipals` 今天是不带前缀的裸 uuid 数组（`packages/db/src/schema/kb/documents.ts:60`），admin 也是 uuid 粘贴。B2-2 的 Then 写「principal 变更（**移出 role**）」—— 在角色 principal 落地前该句无法真绿。要裁的是口径（属 P3b 还是留雾），不是实现难度。
- **grant 写审计是否落表**：现在只有 Pino（`apps/api/src/routes/dept-grants.ts:110-115`、`:141-144`），AE7 的 Then 写「审计有记录」，ADR-057 `:1832` 也写「审计」。落表要先裁口径。
- **镜像陈旧项**：`docs/module-status/api.md:93` 与 `docs/testing/coverage/02-acl.md:49` 把「缺『激活 version』表示」记作 B2-2 的前置，但 `packages/db/src/schema/kb/documents.ts:39` 的 `active_index_version` 已由前图 L7 落地并在 `apps/worker/src/ingest/pipeline.ts:983-986` 原子写。需核实后回写。
- **`DEPT_INHERIT_DOWN` 关继承时 ES 侧的对称**：`collectVisibleOwnerDeptIds`（`apps/api/src/services/retrieve/dept-acl.ts:135-164`）在关继承时只精确匹配；ES 侧靠同一来源的 `ownerDeptIds`，但**缺 `ownerDeptId` 字段的库级文档**在关继承时的语义未定义（PG 说是「库内成员可见」）。

## Out of scope

- **P2.5 二元出口**（准出 / 永久关）：准出需真模型 live 跑数 + 人签（`packages/contracts/src/eval/l2-matrix.ts:38-48` 第一句就要求 `retrieveMode==='live'`），永久关需产品书面签字；两者都不在本图。**连带发现另图处理**：PRD 阈值「近指代主题正确且合法作答 ≥ 80%」（`prds/08-quality/02-evaluation-and-gates.md:188`）在判定公式里**没有实现**（公式只看零容忍命中与九类覆盖，不看 pass/fail 比）—— 这是「门禁比 PRD 松」的疑点，须另图裁定（本图不动 `prds/00–11`）。
- **真 ES 集群 / IK 插件 / 多租户独立索引布局**（B8）：本图只做到「builder 级可断言」的切片（fetch stub / 纯函数）。
- **敏感语料入池**：路线图 `:209` 明写「**此后**方可讨论」，属安全另签。
- **业务人签 / 签字页勾选**：人不在环内，不代签。
- **改仓库默认开关**（如 `DEPT_ACL_ENFORCE=true`）：须 ADR → 改 PRD → 升版。
- **admin 站规余量**（20 处原生 `<select>` + 4 处旧 `Select`）：属站规清扫，非本图缺口；本机无浏览器验证手段。
