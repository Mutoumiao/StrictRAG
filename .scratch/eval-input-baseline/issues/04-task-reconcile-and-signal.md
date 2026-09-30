# 04 · 落：账本 ↔ 库内对账 + 题源差异信号（按 02 / 03 的裁定）

Type: task
Status: resolved
Parent: ../map.md
Blocked by: 02, 03

## Question

按工单 02 与 03 的裁定落地共享层对账 + 两侧入口接线 + 题源信号 + 契约收紧，并带反证与测例登记。

## Answer

**实现**（单一实现代理落地，主控逐行复核；一次收口修复）：

| 包 | 改动 |
|---|---|
| `contracts` | `corpus-ledger.ts` 加 `RETRIEVABLE_STATUS` / `RETRIEVABLE_LIFECYCLE` 常量、`LedgerDocRef` / `LedgerReconcileIssue` / `LedgerReconcileDiff` 类型、纯函数 `diffLedgerAgainstDocs`（三类互斥、输出 = 账本顺序）与 `formatLedgerReconcileError`（三类计数 + 逐条明细，前 5 条 + 「…共 N 条」）；`corpus-ledger-file.ts` 的 `resolveCorpusLedgerForRun` 改 **async** 且 `lookupDocs` **必填**，顺序 = `kbId` → 指纹 → 对账；新增 `readRepoGoldCaseIds` / `goldSetMatchesRepoFile`；`l1-repro.ts` 加 `goldSource` / `goldSetMatchesRepoFile`；`eval-run.contract.ts` 映射来源三键**收紧为必填** |
| `api` | `documentRepo.listDocRefsByIds`（按 id 批量取对账投影，空入参不发查询）；L1 / L2 两个 CLI 接对账（`await` + 可注入 `lookupDocs`，缺省真库）；L1 报告填 `goldSource: 'file'` 与题集比对真值，并进 md 渲染 |
| `worker` | 新增 `src/eval/doc-refs.ts`（`lookupDocRefs` + `evalRepoRoot`，仓根口径与既有 L2 题面缺省路径同一表达式）；L1 / L2 批跑接对账（缺省真库，生产不可绕）；L1 报告填 `goldSource: 'db'` |

**门禁**：`check-types` 8/8 · `lint` 8/8 零 warning · contracts **36 文件 / 317 通过** · api **183 文件 / 1144 通过** · worker **61 文件 / 283 通过**。

**反证（放宽 → 逐条见红，事后还原并复跑全绿）**：① 去掉对账 `throw` → api 与 worker 各 3 例红；② 去掉 title 判据 → contracts 2 例红；③ 题集比对恒真 → 1 例红；④ 未知态 `null` 改 `false` → 2 例红；⑤ 翻转题源标注 → 6 例红；⑥ 三键改回可选 → 1 例红；⑦（收口修复轮）去掉 `docId` 唯一性 → contracts 2 例红；⑧（同轮）去掉库读失败的包装 → worker 1 例红。

**两个独立对抗性验证代理的发现与处置**（角色互斥：闸的有效性 / 题源信号与契约一致性）：

| 发现 | 处置 |
|---|---|
| `CorpusLedgerError` 上方注释仍写「docId 是否在库内不做运行时校验」，与本笔实现**相反**（陈旧镜像） | **已修**：改为错误族描述 |
| `lookupDocs` 自身抛错原样冒出 → CLI 走 `exit 1`，与「坏账本 exit 2」不齐 | **已修**：包成 `CorpusLedgerError`（「查不了」与「查不到」分开），并补测例 |
| 账本只去重 `logicalId`、不去重 `docId` → 两个逻辑 id 可指向同一 uuid（Hit@k 输入被悄悄合并） | **已修**：`buildCorpusLedger` / `parseCorpusLedger` 同口径拒，抽 `assertLedgerEntriesUnique`，双侧补测例 |
| `emptyL1Repro()` 的 `goldSource` 模板值 `'file'` 会让「漏接线」冒充 `file` | **已修**：值域加 `null`（= 未标注），模板取 `null` |
| 「多一个 / 少一个 / 重复」与「截断不影响两键」缺专门测例 | **已补**：contracts 1 例 + api 1 例 + worker 1 例 |

**诚实边界**：① 收口轮之前，全部验证都在注入桩上做（当时本机 Docker 未起），真库 SQL 行为未验 —— 由工单 05 补上；② worker 侧 `goldSetMatchesRepoFile` 为 `true` 只在「题集就是从仓内基线灌进 DB」时成立（真库实测的 60 条 `case_key` 正是基线 id），运营自定键 / 反馈晋升键会让它读作 `false` —— 这正是该信号要暴露的东西，**不是**缺陷；③ 本图**未**新增「文件 → DB」灌题入口，题源未收敛。

## Comments

- 复核方式：主控逐 hunk 读实现 + 两个验证代理独立重导需求后攻击；对「代理说通过」的项（`check-types` / 三包测试 / 反证条数）均由主控复跑或按构造判定。
