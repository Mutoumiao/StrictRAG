# 06 · 回写镜像 + 收口门禁 + 封图

Type: task
Status: resolved
Parent: ../map.md
Blocked by: 04, 05

## Question

回写受影响的镜像与 spec、跑收口门禁、做对抗性反向复核、更新雾清单注记并封图。

## Answer

**回写（12 个文件）**：

| 类 | 文件 | 写了什么 |
|---|---|---|
| IS 镜像 | `docs/module-status/contracts.md` · `api.md` · `worker.md` | 「最近更新」新条目 + 正文段；worker 的「失效三态」改**四态**（未设置 / 账本不可用 / **库内对账不过** / 自洽）；contracts 的账本子路径清单补新导出与新测例 |
| IS 镜像 | `docs/module-status/README.md` | 能力矩阵「观测 / 评测」行补对账与题源两键（矩阵表头「全量核对」日期**不动** —— 增量回写不做全量审计） |
| 运维 | `docs/ops/operable-stack.md` | 账本段补对账口径；worker 段「三态」改「四态」 |
| 运维 | `docs/ops/real-stack-evidence.md` | 新增 **§9**（本图真栈四档 + 队列侧实测 + 留痕 + 未核实） |
| 派生对照 | `docs/testing/coverage.md` | 新增 **第十三轮** 叙述（**覆盖值零变化**，并写明三条判据线与 38 簇中的任何一行**无对应关系**） |
| HOW | `.trellis/spec/api/backend/l1-eval.md` | 环境键表 `L1_DOC_MAP` 行补对账失败档；账本段补「跑批前库内对账」四条（为什么不止查存在 / 库读走注入 / 库不可达不等于通过 / docId 唯一性）；§8「取真值」补两键；「未做（债）」补「把两侧题集不同接成硬门须 ADR」 |
| 导航 | `.scratch/fog-inventory-2026-09-23.md` | 追加本轮注记（销的是**图级** `Not yet specified`，**不成簇**，表不逐行改） |
| 本图 | `.scratch/eval-input-baseline/map.md` + 六张工单 | 裁定 / 落地 / 真跑 / 目的地达成 / 雾的余量 / 封图 |

**收口门禁（最后一次提交之后复跑）**：

- `pnpm check-types`：**8/8**（exit 0）
- `pnpm lint`：**8/8 零 warning**（`eslint --max-warnings 0`）
- `pnpm test --concurrency=1`：**11/11 包**（contracts 36 文件 / 317 · api 183 / 1144 · worker 61 / 283）
- `pnpm check:module-status`：**39 条**（`2-env` 2 · `3-符号` 13 · `5-表` 24），**`1-路径` / `6-联动` / `7-时效` 三类为空** —— 与基线逐类一致。**过程中发现并修掉自己造的两处「表」类噪声**：回写文字里把 `lifecycle` / `null` 加了反引号，被脚本当表名（43 → 41 → 39 一路清回基线）；同时把三份镜像的日期由 `2026-09-30` 改为实际提交日 `2026-10-01`，否则 `7-时效` 非空。

**对抗性反向复核**：由独立代理逐条核「镜像里这句话在源码里真能指到吗」，重点核四类易错处（① 把「有闸」写成「进判定」；② 把「注入桩验过」写成「真跑验过」；③ 把「L1」写成「两侧都做了」；④ 反引号把裸标识符写成表名）。发现与处置见「Comments」。

**封图**：`map.md` 前沿已空，`Status: resolved`。

## Comments

- 反向复核结论：**镜像声明逐条能指到源码**；**未发现**「说的比做的大」类高估，但查出 **3 处措辞过度承诺**，逐条收紧：
  1. **「消息点名 logicalId + docId + 实测 status / lifecycle / title」是无条件写法，过宽** —— `missing` 类**查不到行**，没有 status / lifecycle / title 可测（行属别 KB 时才带 `kbId`）。已在 **6 处**（`docs/module-status/api.md` ×2、`docs/module-status/worker.md`、`docs/ops/operable-stack.md`、`docs/testing/coverage.md`、`.trellis/spec/api/backend/l1-eval.md`）改为「并在**该行可得时**带实测 …」。
  2. **spec 自相矛盾**：`l1-eval.md` 的 worker 段仍写「**失效三态**」，与本轮新增的对账档相抵 → 改「**失效四态**」并补「库读本身失败」与「库内对账不过」两档。
  3. **`real-stack-evidence.md` §9 标题「对账闸**四档**实测」与表里的 7 个场景不符** → 改「对账闸与题源信号的**七档**实测」。
  - 反向复核另**独立复核**了三件事：① 库内该 KB 13 行全 `ready ∧ active`（N2 已还原）；② 队列侧失败行 `01a0f32b-…` 的 `status=failed` 与 `error_message` 与证据文逐字一致；③ `prds/` / `fixtures/` / 各 `env.ts` / `l1-matrix.ts` / `adr046-snapshot.ts` 在五个提交里**零改动**。
  - 「失效三态」一词在 `docs/testing/coverage.md` 的**第十二轮**叙述里**保留不动** —— 那是对上一图当时状态的史实记录，不是本轮口径。
- 三条口径纪律在回写里被显式守住：① 对账与题源两键**都不进判定**（镜像与 spec 都点明「做硬门须 ADR」）；② worker 侧 `goldSetMatchesRepoFile` 的**真跑未验**如实写（只在 api CLI 真跑里读过 true / false）；③ L2 侧对账**源码同构但未真跑**，镜像未宣称 L2 已验。
- 收紧之后复跑 `check:module-status`：仍 **39 条**（2 env + 13 符号 + 24 表），`1/6/7` 三类为空。
