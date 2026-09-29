# 裁定：映射账本的形状与解析落点（含未映射行为与新鲜度）

Label: wayfinder:dec
Type: dec
Status: resolved
Blocked by: 01

## Question

（见下 `## Answer`：按工单 01 的事实逐组裁定。）

## Answer

主控裁定（2026-09-29）。依据：工单 01 的事实（`research/01-corpus-map-surface.md`）与地图红线。**五组裁定 + 一条范围裁定**，全部落在「收紧或逐位等价」一侧。

### 裁定 1 · 账本形状与落点：一份账本 = 一个 KB，落 `artifacts/`，形状由 contracts 子路径唯一锚住

- **一份账本 = 一个 KB**。L1 / L2 走**两个独立 KB env**（`L1_KB_ID` / `L2_KB_ID`），故账本按 `kbId` 分辨，文件名含 `kbId` 以免两份互相覆盖。两侧共用的 3 个逻辑 id（`ingest-samples/01..03-doc`）各库各有一份，**不合并**。
- **形状（`version: 1`）**：
  - `version` · `kbId`（**必填**）· `tenantId` · `generatedAt`（与仓内写库口径一致的本地格式串）
  - `corpusFingerprint`：对 `fixtures/ingest-samples/*.txt` 与 `fixtures/l2/corpus/*.txt` 按**逻辑 id 升序**取 `logicalId + ':' + sha256(文件字节)` 拼接后再 sha256
  - `entries: [{ logicalId, docId, title, sourceFile, sourceSha256 }]`，**按 `logicalId` 升序**（确定性：同输入同输出）
- **落点**：默认 `artifacts/eval-corpus-ledger-<kbId>.json`。`artifacts/` 整目录已 gitignore（与 `artifacts/l1-last-run.json` 同例）→ 账本是**运行产物，不入库**。理由：`docId` 是环境相关 uuid，提交进版本库等于**假证据**。
- **「可核对」的判据（不用人眼）**：① 第三方用同一份夹具 + 同一条命令可在同构环境重建**除 uuid 外逐键等价**的账本；② 账本 ↔ 夹具的对应由 `corpusFingerprint` 机械校验；③ 账本 ↔ 库内文档由 `entries[].title` + `GET …/documents`（全量、无分页）对账。
- **唯一源**：形状与解析口径放进 `packages/contracts/src/eval/corpus-ledger.ts`，经**子路径导出**（`@strict-rag/contracts/eval-corpus-ledger`）—— 同 `eval-repro` / `eval-repro-l2` 先例，避免 `node:crypto` 进 web/admin 客户端图。
- **被否**：把账本提交进版本库（uuid 环境相关，会被当成「映射已存在」的证据）· 把绑定清单再手抄一份进脚本（会漂，改为与两份 README 表对账）。

### 裁定 2 · 解析落点：新增 TS CLI 出入库入口 + 在跑批 CLI 比对前解析；参数走 env

- **入库入口 = 新增 TS CLI** `apps/api/src/scripts/ingest-eval-corpus.ts`（env 驱动、缺配置 `exit 2`，与两个 eval CLI 同风格）；HTTP 步骤语义照 `scripts/demo-ingest.mjs`，但**不动** `demo-ingest.mjs`（它有「未批 scan 403」负例与 S1 demo 断言，改动会牵动既有叙事与测试）。理由：账本口径必须与跑批侧共用**同一份 contracts 契约**，而 `.mjs` 取不到 TS 契约。
- **解析落点 = 跑批 CLI 内、`hitAtKCase` 之前**：`expectedDocIds` 逐条经 `resolveExpectedDocIds` 换成 uuid。**不传账本参数时与今天逐位一致**（同一夹具 → 同一 `hitAtK` / `hitAtKHits` / `hitAtKScored`）。
- **被否**：① 把 uuid 写回 `fixtures/*`（改冻结数据文件）；② 在 gold 加载器里解析（加载器是多方共用的纯解析，塞文件 I/O 会污染）；③ 改 `hitAtKCase` 本体（会让纯函数依赖外部映射）。
- **参数形状 = env**（`L1_DOC_MAP` / `L2_DOC_MAP`）：两个 eval CLI 的配置**全走 env**，唯一 CLI flag `--human-spot` 传的是**文件内容**而非配置；账本路径与 `L1_KB_ID` 同类。需在 `turbo.json` 的 `test`/`lint` env 段登记（研究已给出位置）。
- **范围**：**L1 api CLI 必接**；**L2 api CLI 同构接**；worker 侧 `apps/worker/src/eval/run-l1-batch.ts` / `run-l2-batch.ts` 两处**本图不改** —— 如实记为剩余雾，并写明后果（worker 批跑的 Hit@k / docHit 仍恒 0，且两者**都不进任何判定** → 不是假绿，是同一数据工程缺口的另一处表现）。

### 裁定 3 · 未映射 / 账本不可用：缺映射**继续算 miss**，绝不变成 `null`

| 情形 | 行为 |
|---|---|
| (a) 不传账本参数 | 与今天**逐位一致**（`docMapSource='none'`）；**不新增「该门不适用」出口**，`hitAtK` 仍是真比值（今天 = 0/30） |
| (b) 传了账本但某逻辑 id 不在其中 | 该 id **原样保留** → 比对必然 miss（**语义不改**）；报告 `docMapUnmappedIds` 列出它们 |
| (c) 账本 `kbId` ≠ 本次 KB，或 `corpusFingerprint` ≠ 当前夹具指纹 | **拒跑**（`exit 2`，消息点名差在哪）—— 拿 A 库的映射跑 B 库或拿过期映射跑，都是无意义且危险的 |
| (d) 账本文件不存在 / 解析失败 | **拒跑**（`exit 2`）。传了参数却用不上，静默降级比报错危险 |

- **报告落点（L1 顶层三个新键）**：`docMapSource: 'ledger' | 'none'` · `docMapResolved: number`（成功换成 uuid 的**去重后**逻辑 id 数）· `docMapUnmappedIds: string[]`（账本里没有的逻辑 id，字典序去重）。L2 侧**同构三键**。
- **三者都不进任何判定**：`computeSignoffEligible` 与 `evaluateAdr046Bind` 的**公式与门限一字不动**（`hitAt20Min = 0.7` 不动；`hitAtK == null` 的「有标注时」语义不动）。
- **被否**：放进 `repro` —— `repro` 键集被 `l1-repro.test.ts` **精确等值**钉住（14 键），且 `l1-repro.ts` 文件头明令「不许在本区块里再造第二源」。
- **为什么这不是放宽**：本题只把**数据面**补上，门与门限没动；未映射时 `hits` 不增、`scored` 照加 → `hitAtK` 与今天同值，门照样可能不过。**「补数据」不等于「降门」**。

### 裁定 4 · 新鲜度：两项机械判定，失败即拒跑；「docId 还在不在库里」不做运行时校验

- **机械判据**：`kbId` 全等 **且** `corpusFingerprint` 全等。任一不成立 → 拒跑（裁定 3(c)）。
- 账本每条记 `sourceSha256` → 指纹由它派生，「夹具被改」能**定位到具体文件**。
- **不做**运行时「账本 docId 是否仍在库内」校验：那会让 eval CLI 引入新的 DB 读，扩大回归面；改由账本记 `title` + 人用 `GET …/documents` 全量对账。此项**如实记为本图剩余雾**（不是本图欠账，是显式划出）。

### 裁定 5 · L2 范围：一起接，但**不进判定**

- L2 api CLI 一起接（同构三键 + 同构解析），但 `docHitRate` / `docHit` **仍然不进** `computeL2SignoffEligible`（前图已裁「PRD §6.2 没有这个门」）。本图**不动**该裁定，只在报告里让这个数字第一次变成真值。

### 裁定 6 · 实现纪律（对工单 03/04 的硬约束）

- 新增 env 键（`L1_DOC_MAP` / `L2_DOC_MAP`）若要出现在 `docs/module-status/` 正文，须同时把该 token 加入 `scripts/module-status/check.mjs` 的配置名黑名单（`:298-299` 一带已有 `L1_KB_ID` 等先例），以维持基线条数（39 = 2 env + 13 符号 + 24 表）；**不得**为此放宽任何检查逻辑。
- 加「报告新键」会打到研究工单列出的回归面（L1 三处字面量报告、worker 逐键白名单、`repro` 精确键集、md 渲染断言）；**L1 侧 worker `saveReport` 的逐键白名单必须同步加键**（漏键 = 库内静默丢失、零测试红）。
