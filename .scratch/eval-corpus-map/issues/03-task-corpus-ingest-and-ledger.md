# 落「评测语料入库入口 + 可核对映射账本」

Label: wayfinder:task
Type: task
Status: resolved
Blocked by: 02

## Question

按工单 02 的裁定，把**评测语料入库**做成一条有文档、可重复、可核对的命令（新脚本或扩既有 `scripts/demo-ingest.mjs`，由裁定书定），做到：

1. **覆盖两侧语料**：至少 `fixtures/ingest-samples/*.txt`（L1）与 `fixtures/l2/corpus/*.txt`（L2）都能入库；入库动作走**既有 HTTP 面**（`upload-url` → PUT → `complete` → `approve` → `scan` → 轮询 ready → `lifecycle=active`），**不新增端点、不新增表、不新增迁移**。
2. **账本可核对**：命令退出前写出裁定书规定的映射账本（逻辑 id → `documents.id`，含裁定书要求的绑定字段）。账本形状要有**契约或 schema 级**锚（若落进 `packages/contracts` 或脚本内的纯函数，两处口径只能有一份），并保证**重复解析稳定**（同输入同输出）。
3. **绑定关系来自夹具本身**：逻辑 id ↔ 文件的绑定必须从工单 01 核实的**权威处**取，不允许脚本里再手抄一份清单（手抄会漂）。若权威处是两份 README 的表格，注明「以 README 为准」并加一条**对账测例**（README 表 ↔ 脚本解析结果）。
4. **对账而不是假绿**：脚本要能**回报**它建/复用了哪个 KB、每篇文档的终态、以及账本条目数 = 映射到的逻辑 id 数；**失败要点名**是哪个逻辑 id 没入库（不得静默跳过）。
5. **测例**：新增 `<包>/tests/<能力>/<意图>.test.ts(x)`（简体中文头 + 登记 index）。至少钉：账本形状与稳定序 · 缺文件 / 入库失败时的行为 · 「逻辑 id 无对应文件」时的行为 · README 表与解析结果的对账。
6. **反证**：给出至少两轮「破坏后变红」的实证（如把某逻辑 id 的绑定改错、把账本写成非确定序），并记录还原后全绿。

**不许**：改 `fixtures/` 数据文件 · 把逻辑 id 硬编码进脚本 · 用「按标题猜」代替账本 · 新增迁移 / 表 / HTTP 端点 · 改任何门限数字。

产物：脚本 + 账本契约 + 测例 + 反证记录（工单 `## Answer` 里写清命令、退出码语义、失败点名的样例输出）。

## Answer

**已解**（实现由子代理按裁定书落，主控逐文件复核 + 独立复跑门禁）。

**契约面**（新文件 `packages/contracts/src/eval/corpus-ledger.ts`，子路径导出 `@strict-rag/contracts/eval-corpus-ledger`）：
- 类型 `CorpusLedger` = `version(=1)` · `kbId` · `tenantId` · `generatedAt` · `corpusFingerprint` · `entries[{logicalId, docId, title, sourceFile, sourceSha256}]`（**按 `logicalId` 升序**）
- 纯函数：`parseCorpusLedger`（形状 + 版号 + **自洽**：`corpusFingerprint` 必须等于按 entries 重算值）· `buildCorpusLedger`（重复逻辑 id / 坏 sha → 抛）· `corpusFingerprint`（升序 `logicalId:sha` 以 `\n` 连接后 sha256）· `sortLedgerEntries` · `resolveExpectedDocIds`（命中换 uuid，**缺映射原样保留**）· `summarizeDocMap`（报告三键）
- `node:crypto` 只在子路径模块里（主入口保持可进客户端打包），与 `eval-repro` 同例。

**入库入口**（新文件 `apps/api/src/scripts/ingest-eval-corpus.ts`，env 驱动、缺配置 `exit 2`）：`health→ready→dev-login→建/复用 KB→逐篇 upload-url/PUT/complete/approve/scan→轮询 ready→lifecycle=active→写账本`；账本落 `artifacts/eval-corpus-ledger-<kbId>.json`（`artifacts/` 已 gitignore）；打印 `kbId` 与账本路径供 `L1_KB_ID` / `L2_KB_ID` 复用；**未拿到 docId 的语料抛错点名**（不静默跳过）。语料目录与逻辑 id 前缀的绑定来自 `apps/api/src/eval/corpus-fixtures.ts`（**目录结构派生**，不手抄清单）。

**一处只在真跑才现形的缺陷，已当场修**：CLI 原设计「全步带 token」→ 同一身份上传并审批 → 撞 **ADR-048 #4 四眼闸**（`routes/documents/index.ts:469-476` 的 `evaluateSelfDecide`）必 403。改法照 `smoke-half.mjs` 先例：两个 dev-login 身份（`ingest-eval-corpus@local.dev`/`super_admin` 与 `ingest-eval-reviewer@local.dev`/`kb_admin`），**只用审批人 token 调 approve**，并在首篇先**钉住「上传者自审必 403」**（非 403 即失败）。附注：`scripts/demo-ingest.mjs` 没这个坑，因为它 approve **不带 token** → 无 actor → 闸不点火（故未动它）。

**显式边界（不静默）**：`AUTH_ENFORCE=false`（默认）时审批人无需是该 KB 成员；`AUTH_ENFORCE=true` 时**审批人必须是该 KB 成员**，本 CLI **不自动加成员**（已写进 CLI 头注释与 `.trellis/spec/api/backend/l1-eval.md`）。

**测例**：`packages/contracts/tests/eval/corpus-ledger.test.ts`（15 条）· `apps/api/tests/eval/ingest-eval-corpus.test.ts`（13 条，含四眼三条）· `apps/api/tests/eval/eval-corpus-map.test.ts`（5 条，新鲜度/拒跑）；已登记各包 `tests/index.md`。

**反证**（4 轮，均记录破坏点与还原后全绿）：① 比较前不解析 → `l1-doc-map` 2 红；② 去掉指纹新鲜度校验 → `l1-doc-map` 1 红；③ worker 白名单漏键 → `persist-doc-map-keys` 1 红；④ 审批换回上传者 token → `ingest-eval-corpus` 1 红。

**未做**：`fixtures/` 数据文件一字未动（只改两份 README 的说明文字）· `scripts/demo-ingest.mjs` 未动 · 未新增迁移/表/端点 · 未跑服务（真栈实测属工单 05）。
