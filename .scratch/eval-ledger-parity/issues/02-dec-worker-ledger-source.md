# 裁定：worker 侧账本的来源 / 读取时机 / 失效语义 / 落库形状

Label: wayfinder:dec
Type: decide
Status: open
Blocked by: 01

## Question

在工单 01 的事实面上，把下列各组**逐组裁定**并写下理由与被否掉的备选。裁定必须**收紧或不改变**语义，改仓库默认开关、改门限、把缺失映射写成 `null` 都不在可选集内。

1. **账本从哪来**（本图核心裁定）。至少比较三条：
   - **(a) 与 api CLI 同名的 worker 进程级 env**（`L1_DOC_MAP` / `L2_DOC_MAP`）；
   - **(b) job payload 下发**（`EvalJobDataSchema` 加可选字段 → 连带 `CreateEvalRunBodySchema` + 入队侧 + 可能的运营台表单）；
   - **(c) 按 `kbId` 约定发现**（如 `EVAL_LEDGER_DIR` + `eval-corpus-ledger-<kbId>.json`）。

   逐条给出：**爆炸面**（要改哪些文件、哪些契约、哪些前端）、**表达力**（一个 worker 进程同时服务多 KB 时是否够用）、**与本仓既有形状的一致性**（工单 01 第 2 项的结论）、**失效可见性**（人对不上时能否一眼看出）。裁定要指名**选哪条、为何否掉其余**，并写明「一个 worker 进程同时服务多 KB 的账本」这一限制**是新增的还是既有的**（若既有，举出同款先例）。
2. **读取时机与作用域**：在 `handleEvalJob` 开始处读一次（每次 job 重读，账本被换即生效）还是进程启动时读一次。若选「每次 job 重读」要写明 I/O 成本与失败传播路径。
3. **失效语义**（本图红线所在）。三态必须**互相可分辨**：
   - **未设置** → 与今天逐位一致（三键 `none` / `0` / `[]`，缺映射继续算 miss）；
   - **设置了但不可解析 / `kbId` 不符 / 语料指纹不符** → **响亮失败**（`markFailed` + `ok:false` + 错误信息点名原因），**不得**降级成「未设置」；
   - **设置且自洽** → 解析后再进 `hitAtKCase`。

   写明错误信息的**措辞约定**（与 api CLI 的 `exit 2` 消息是否共用一套文案）以及 job 失败是否消耗重试（核对 `EVAL_JOB_DEFAULT_ATTEMPTS`）。
4. **落库形状**：`persist.saveReport` / `saveL2Report` 的三键是否改为**取报告真值**（`report.docMapSource` 等）。若改，写明「未设置账本时报告里的真值恰好等于今天的常量」这一等价性由什么保证；`eval_runs.report_json` 与 api CLI 侧（`buildEvalRunInsert` 整对象直落）的形状是否就此同构。
5. **L2 是否同办**：`runL2Batch` + `L2_DOC_MAP` 是否与 L1 同一图形处理（含 error 分支那处 `hitAtKCase(c.expectedDocIds, [])`）。写明 L2 侧 `docHitRate` **仍不进任何判定**这一点在本图是否改变（预期：不改变，本图只对齐含义）。
6. **「账本 ↔ 库内文档存在性对账」是否纳入本图**（承接前图 A 段第二条）。若纳入，写明两侧（CLI 无 DB 读 / worker 有 DB 读）怎么统一、爆炸面多大；若不纳入，写明理由与被转给下一图的确切范围。**本组必须给出明确裁定**，不许留空。
7. **配置键的连带**：若新增 env，是否需要登记 `turbo.json` 的 env 段；若该键要进 `docs/module-status` 正文，是否需要同步加进 `scripts/module-status/check.mjs` 的黑名单以守住基线 **39 条**（前图先例）。

产物：本工单的 `## Answer`（逐组裁定 + 理由 + 被否备选），必要时附 `research/02-dec-notes.md`。**只写裁定，不改代码。**

## Answer

<!-- 收口时填 -->
