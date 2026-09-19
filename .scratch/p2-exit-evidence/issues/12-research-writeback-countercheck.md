# 反向复核：这轮回写是否引入新的高估

Type: research
Status: resolved
Blocked by: —

## Question

工单 [05](./05-writeback-mirrors.md) 按源码回写了三处镜像、工单 [06](./06-coverage-table-writeback.md) 回写了覆盖表。审计（[01](./01-research-ledger-drift.md)）当时只查出「低估 25 处、高估 0 处」—— 但**回写本身可能反向引入高估**：把话说满、把「部分」写成「已完成」、把带条件的结论写成无条件、把未验证的东西写成已验证。

本票要独立复核：**回写后的三处镜像 + 覆盖表，有没有任何一行现在写着源码并不支持的东西？**

复核范围（逐行读磁盘现状，与源码 / 测例对照）：

- `.trellis/tasks/08-06-project-backlog/status.md`（尤其 §0.1 新标签「已关闭（划出）」的定义与 §2.5.2 十一行的新状态）
- `prds/12-delivery-guides/04-交付控制台.md`（尤其 **§0.7 十四行 HALF-\*** —— 它们从「未开始」一次性改成「已完成」，是本次改动面最大的一处；以及 §0.3 / §0.4 / §0.5 / §0.6 的改动行）
- `docs/module-status/README.md` 矩阵与 `api.md` / `worker.md` / `db.md` / `contracts.md` / `admin.md` 的改动行
- `docs/testing/coverage*.md`（尤其工单 06 改成 `已测` 的 10 行 + 新增的 `N2 / Z3 / C4` 三行 + `S6` 改判）

## 复核方法（必须做的两件事）

1. **逐行反证**：对每一处「改成更强结论」的行，去源码/测例里找**反例**（该能力其实只做到一半、只覆盖一种输入、只在 mock 下成立、有边界没做）。找不到反例才判「成立」。
2. **交叉一致性**：同一事实在三处镜像里是否说法一致（例：L7 的「周期调度未落」是否三处都在；`drizzle/meta` 的「已补 `0021`」是否与 `packages/db/drizzle/meta/` 实际文件一致；`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / rewrite / `RETRIEVE_ES_MODE` 的默认值在被改动的行里有没有被说成已开）。

## 输出
写到 `D:\projects\ai-stared-project\StrictRAG\.scratch\p2-exit-evidence\research\writeback-countercheck.md`（**只写这一个文件**）：

- 开头 3–5 行结论（共查 N 行改动；判定「成立」x 行、「**新引入高估** y 行」、「表述含糊需收紧」z 行）。
- 一张表：`| 文件 | 行/ID | 改动后的声称 | 反证搜寻结果（含路径） | 判定 |`
- 判定只取三值：`成立` / `**新高估**`（附应改成什么，给可直接粘贴的文本）/ `需收紧`（表述含糊，附建议文本）。

## 边界
- **只读 + 只写上面那一个研究文件**。**禁止**改镜像、源码、覆盖表、map 或工单；**禁止** `git add` / `git commit`。
- 只读 `.md` 与源码，不需要跑测试；若某行必须跑测试才能判，写「需跑测试」并说明跑哪条。
- 结论必须保守：**说不清就判「需收紧」**，不要为了给出干净结论而放过可疑行。
- 全程**简体中文**。

## Answer

产出：[`research/writeback-countercheck.md`](../research/writeback-countercheck.md)（逐行表 + 可直接粘贴的替换文本）。

**逐行核了四处镜像共 67 处改动**（`§0.7` 的 14 条 HALF-\* 逐条核过），结果：**成立 53 · 新高估 1 · 需收紧 13**。

**唯一的「新高估」**：`docs/module-status/db.md` 把「`drizzle-kit generate` 恢复可用」的硬验收写成「**仓内**跑出 `No schema changes…`」，而工单 [11](./11-drizzle-meta-baseline.md) 的原始记录明写该验收**只在仓外副本达成、未在仓库工作区跑过**。镜像把验证位置说错了 —— 读者会认为仓内已验。**已改**。

**13 处「需收紧」的类别**（都不属于「把没做的说成做了」，而是「同一事实几处说法不一」或「证据只覆盖 Then 的一半」）：

- **三处两说**：覆盖表 K5 仍写 `缺实现` 而 backlog / 交付控制台已判「已具备」；`api.md` / `worker.md` 写「**无**处置」而同篇已记 resolve 端点；`§0.6` 的 P2.5-L3A 漏跟 §0.3 的口径（本次漏改）；spec 的 `drizzle/meta` Gotcha 与 `db.md` 新口径对立。
- **证据只覆盖一半**：V4 的 Then 含「其后 M/L 链可绿」但只有分段证据（已**退回 `部分测`**）；AB8 声称的「保存 recommended」无对应断言；N2 证据漏列 ask 侧测例；C4 写「映射层**已补**」而仓内**无任何映射实现**（`fixtures/l1/README.md:23` 明说映射是跑批前人工步骤 → 直跑 Hit@k 恒 0），本轮补的只是「未映射不得伪命中」护栏。
- **指针与真跑**：`§0.7 #10` 的指针 `parse-*` 悬空（实际是 `extract-text.ts`）；`#2/#4/#5` 三个 HALF-\* 的「真起 / 烟测 / 种子」**仓内无真跑记录**（归档 task 的 AC 全未勾）。
- **记法**：`admin.md` 的「最近更新」条目自指且日期与本次复核不同源。

**它挖出一个真缺口（本图据此开出工单 [13](./13-es-query-third-path-tenant-gate.md)）**：`apps/worker/src/ingest/es-http.ts` 的 `listIndexedChunkIds` 是**第三条 ES 查询路径**，原只按 `docId` 查、无租户闸也不失败 —— 所以 QUAL-TENANT-Q 的「无 `tenantId` 的 ES query builder 必失败」在**全仓口径**下仍不成立。

**它核过且没问题的方向（同样重要）**：四分册行级计数机械重数与合计逐格相符；被改动的行里**没有一处**把 `AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / `SESSION_REWRITE_ENABLED` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` 说成已开；L7 的「周期调度未落」在四处镜像都在；`§2.5.2` 的 11 个新 issue 指针全部真实存在；E4 / E5 / V3 / Q4 / AA1 / R10 / AC7 / Z3 / S6 的源码与测例逐条对得上。

**收口**：14 条修正**已全部应用**（含那条新高估），并连带把批 2 的 17 行覆盖改 `已测`、重算三处计数表 —— 详见地图「Decisions so far」。**本票证明了一件事：只做「正向回写」不够，回写之后必须做一次对抗性复核** —— 否则把「验证发生在哪」写错这种错误，正向审计永远查不出来（它只查「说的比做的大」，不查「说的位置不对」）。
