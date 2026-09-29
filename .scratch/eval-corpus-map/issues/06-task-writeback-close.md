# 回写镜像 / 配方 / 覆盖表 + 收口门禁

Label: wayfinder:task
Type: task
Status: resolved
Blocked by: 03, 04, 05

## Question

把本图的结论写回**该写的地方**，并做一次对抗性复核：

1. **回写清单**（逐条点名文件与要改的那一句）：
   - `docs/ops/`：补一条「评测语料入库 + 出账本 + 带账本跑批」的可复现步骤（插在哪一节由工单 01 的结论定；**不改**已有默认开关的描述）。
   - `fixtures/l1/README.md` / `fixtures/l2/README.md`：「逻辑 id 映射」一节从「人工替换纪律」改写成「有账本入口了，怎么用」，并写清**未映射仍然算 miss**。**只改 README，不动数据文件。**
   - `docs/module-status/api.md`（及 worker / db 若涉及）：按 `update-module-status` 的纪律回写（正文**不写路径行号**、裸标识符**不加反引号**）；写清「Hit@20 现在算得出真数字」与「**未**达标 / **未** live / **未**人签」。
   - `docs/testing/coverage/`：涉及 Hit@k / 逻辑 id 映射的行，**阻塞方**改判为「无仓内可重复的语料入库与映射入口」→ 现已具备，覆盖值按实况给（**不许**因为补了映射就抬成熟度；仍要 live 真跑 + 人签才能算测）。
   - `.scratch/fog-inventory-2026-09-23.md`：簇 **8** 附近的「逻辑 id 映射」相关口子（含 `l2-report-determinability` A 段那一项）标记处置结果，并追加 2026-09-29 的动向行。
   - `docs/ops/real-stack-evidence.md`：若工单 05 在真栈跑出了新的可复现事实，追加一节（或新建证据文并在该文加指针）。
2. **对抗性反向复核**：逐条核「这话在源码里真能指到吗」—— 尤其「门能算出真数字」这条**不许**被写成「Hit@20 已通过」。
3. **收口门禁**（必须在**最后一次提交之后**复跑）：`pnpm check-types` 8/8 · `pnpm lint` 8/8 零 warning · 全仓 `pnpm test --concurrency=1`（并发会让 web 包超时假红）· `node scripts/module-status/check.mjs`（`1-路径` / `6-联动` / `7-时效` 须为空；基线 39 条 = 2 env + 13 符号 + 24 表）· `git status --short` 干净。
4. **按需 commit**：把本图改动按「一个逻辑改动一次提交」落成本地提交（**不 push**），提交说明写清做了什么 / 未做什么。
5. **地图收口**：填各工单 `## Answer`、把决议追加进 `map.md` 的 Decisions-so-far、写「目的地达成情况」、更新 `Not yet specified`（剩下的雾按「谁挡谁」分组，供下一张图挑）。

产物：回写后的文件 + 门禁原始输出摘要 + 本地提交清单 + 收口后的 `map.md`。

## Answer

**已解**。回写清单逐条落地（详见下方表），门禁在**最后一次提交之后**复跑。

| 回写处 | 改了什么 |
|---|---|
| `docs/ops/operable-stack.md` §3 | 补「评测语料入库 + 映射账本」小节：建语料 KB 出账本、`L1_DOC_MAP` / `L2_DOC_MAP` 用法、与今天逐位一致的说明、拒跑条件 |
| `docs/ops/real-stack-evidence.md` | §1 速览加一行（13 篇入库 + `hitAtK` 0/30 → 30/30）；**新增 §7** 记本图：背景（Hit@20 是 PRD 硬门却结构性恒 0）、新增能力、两跑对照表、**不是签字数字**、Docker 自退第 3 次与那次全 error 的留痕 |
| `fixtures/l1/README.md` / `fixtures/l2/README.md` | 「逻辑 id 映射」一节由「人工替换纪律」改写为「映射入口已落 + 怎么用 + 缺映射继续算 miss」。**只改 README，数据文件一字未动** |
| `docs/module-status/api.md` | 工单 03/04 段落 + **真栈实测段**（0/30 → 30/30、`hit_at_k_below_min` 消失、其余阻塞方一条未动、`businessPass` 仍 false、非签字数字、worker 侧边界） |
| `docs/module-status/contracts.md` / `worker.md` | 新契约（子路径导出 + 账本形状）与 worker 两个落库白名单同步加键；worker 侧「不接账本」的边界写明 |
| `docs/testing/coverage/03-ops.md` | **C4** 与派生行 **L2** 的缺口列改写：逻辑 id → uuid 由「跑批前人工步骤」改为「映射入口已落」（C4 仍 `已测`、L2 仍 `部分测`，**覆盖值一律不动**）；L2 的阻塞方收窄为「live 真跑 + 人签」 |
| `docs/testing/coverage.md` | 新增**第十一轮**（2026-09-29，图 `eval-corpus-map`）：**无行级覆盖值变化**（四册合计仍 280 / 163 / 59），写清「补的是数据面不是门禁」、真栈实测结论、判据来源一字未改；「当前保持 `部分测` 的行」里 L2 的括注同步 |
| `.trellis/spec/api/backend/l1-eval.md` / `l2-eval.md` | HOW：账本参数、解析落点、三键、四眼审批与 `AUTH_ENFORCE` 成员边界 |
| `.scratch/fog-inventory-2026-09-23.md` | 追加 2026-09-29 动向行：映射面已落、门限未动、**本图没解决什么**（worker 侧批跑、L2 真跑准出） |

**对抗性反向复核**（逐条核「这话在源码里真能指到吗」）：① 「`hitAtK` 现在算得出真数字」—— 由两跑原始报告 + 两份 `l1-gate-snapshot.json` 的 `reasons` 差集支撑，**不是**「Hit@20 已通过签字」；② 「未传账本逐位一致」—— 有测例与真跑对照（两跑 `matrix` / `errorCount` / `outcome` 分布逐位相同）；③ 「不进任何判定」—— 核过 `PILOT_HARD_GATES` / `computeSignoffEligible` / `evaluateAdr046Bind` / `computeL2SignoffEligible` / `hitAtKCase` 均未改（`git show` 可证）；④ 「覆盖值未动」—— 第十一轮明确写「无行级覆盖值变化」；⑤ 「不是签字数字」—— 每处都点明 mock 向量 / mock chat / 无 IK / `retrieve_mode=live` 只反映 ES 档位。

**未回写（写明理由）**：`.trellis/tasks/08-06-project-backlog/status.md` 与 `prds/12-delivery-guides/04-交付控制台.md` —— 本图**没有**改任何 ID 行 / 关键路径 / 完成标签（`B10-followup` 仍是「部分」，其余硬门余量未变），按总表自身纪律无需同步；且 `/prds` 与 `.trellis/tasks/` 不在版本库（`.gitignore`），改了不留痕。

**收口门禁（在最后一次提交之后复跑）**：`pnpm check-types` **8/8** · `pnpm lint` **8/8** 零 warning · `pnpm run test --concurrency=1` **11/11**（api **181** 文件 / **1134** 通过）· `node scripts/module-status/check.mjs` **39 条 = 2 env + 13 符号 + 24 表**，`1-路径` / `6-联动` / `7-时效` **全空** · `git status --short` 干净。

**本地提交**（**不 push**）：见地图「目的地达成」的提交清单。
