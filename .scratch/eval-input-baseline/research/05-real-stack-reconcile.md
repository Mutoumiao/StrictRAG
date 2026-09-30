# 真栈实测：评测账本跑批前的「库内对账」闸

> 本页是「跑批前账本 ↔ 库内文档对账」这道新闸的**真栈原始取证**。跑在 Windows + Docker Desktop，中间件为 `docker/docker-compose.yml` 的真 PostgreSQL / Redis / Elasticsearch 8.15.3 / MongoDB / RustFS。
>
> **本页任何数字都不是签字数字**：无真 Gateway（chat/embed 仍 mock）、向量仍 mock（dims=8）、ES 是 vanilla 8.15.3 无 IK、`coverage=0`。这些只证明「对账闸的形状」，不证明检索质量、不证明业务达标。

---

## 0. 结论速览

| 场景 | 破坏点 | 期望 | 实测 | 退出码 |
|------|--------|------|------|--------|
| **P 正向** | 无（真账本 + 13/13 ready∧active） | 通过出报告 | ✅ `hitAtK=1`(30/30)、`docMapSource=ledger`、`goldSource=file`、`goldSetMatchesRepoFile=true` | 0 |
| **N1 missing** | 账本某条 `docId` 改成库内不存在的 uuid | 拒跑 | ✅ 点名 `ingest-samples/01-doc→0000…00ff missing` | 2 |
| **N2 not_retrievable** | 库内某篇临时 `lifecycle='superseded'` | 拒跑 | ✅ `not_retrievable=1` + 实测 `status=ready lifecycle=superseded` | 2 |
| **N2′ not_retrievable** | 库内某篇临时 `status='failed'` | 拒跑 | ✅ `not_retrievable=1` + 实测 `status=failed lifecycle=active` | 2 |
| **N3 title_mismatch** | 账本某条 `title` 改一字符 | 拒跑 | ✅ `title_mismatch=1` + 实测 `title=01-doc` | 2 |
| **N4 题源不匹配** | `L1_GOLD_PATH` 指向改了 id 的副本 | 仍出报告但信号翻转 | ✅ `goldSource=file` 不变、`goldSetMatchesRepoFile=false` | 0 |
| **N4′ 坏题源** | `L1_GOLD_PATH` 指向不存在路径 | 另一档：加载失败退出 | ✅ `cannot read gold file … ENOENT` | 2 |
| **M 队列侧** | worker `L1_DOC_MAP` 指向坏账本入队 | job failed 且错误是**对账**那条 | ✅ `status=failed`，`error_message` = 对账原文 | — |

---

## 1. 环境与命令配方

### 1.1 环境（进程级注入，**未改仓库 `.env`**）

前置：`docker compose -f docker/docker-compose.yml up -d` 五服务 healthy；PG 复用既有命名卷（13 篇语料 + 60 题 + 账本仍在）。仓根 `.env` 现为 mock 默认（`RETRIEVE_ES_MODE` 未设、`STORAGE_MODE=local`），故 operable 键全部走**进程级注入**——`apps/*/src/env.ts` 的 `loadDotenv` 不覆盖已存在的进程环境变量，注入优先生效。

注入脚本 `%TEMP%\sr-reconcile\sr-env.ps1`（dot-source 使用）：

```powershell
$env:DATABASE_URL        = 'postgres://strict_rag:strict_rag@127.0.0.1:5432/strict_rag'
$env:REDIS_URL           = 'redis://127.0.0.1:6379'
$env:ELASTICSEARCH_URL   = 'http://127.0.0.1:9200'
$env:ELASTIC_INDEX       = 'strict_rag_dev'
$env:RETRIEVE_ES_MODE    = 'http'
$env:INGEST_ES_MODE      = 'http'
$env:INGEST_SCAN_MODE    = 'mock_clean'
$env:INGEST_EMBED_MODE   = 'mock'
$env:STORAGE_MODE        = 's3'
$env:S3_ENDPOINT         = 'http://127.0.0.1:9000'
$env:S3_BUCKET           = 'strict-rag'
$env:S3_ACCESS_KEY       = 'strict_rag'
$env:S3_SECRET_KEY       = 'strict_rag_secret'
$env:MONGODB_URL         = 'mongodb://127.0.0.1:27017/strict_rag'
$env:AUTH_ENFORCE        = 'false'
$env:DEPT_ACL_ENFORCE    = 'false'
$env:SESSION_REWRITE_ENABLED = 'false'
$env:TAU_CLAIM           = '0.5'
$env:L1_KB_ID            = '01a0eda2-6781-7ca3-90e8-17dcd7ba68c2'
```

### 1.2 三个环境坑（沿用前图配方，本轮全部命中）

1. **不经 turbo**：`pnpm dev:api` 走 `turbo run dev`，其 `dev` 任务 env 白名单会过滤掉 `ELASTICSEARCH_URL` / `STORAGE_MODE` 等 → api 以 mock 起来。**绕法**：`pnpm --dir <包绝对路径> start` / `exec tsx`（不经 turbo）。
2. **PowerShell 下别用 `--filter`**：`pnpm --filter @strict-rag/api …` 的 `@` 被 shell 拼接破坏。**绕法**：`pnpm --dir <包绝对路径> …`。
3. **控制台编码**：PowerShell 默认码页会把错误里的 `→`（U+2192）打成乱码。**绕法**：跑前 `[Console]::OutputEncoding=[Text.Encoding]::UTF8; chcp 65001`；库内原文另用 `psql -A` 复核为准。

本轮 ES 宿主机 9200 一直有监听（无需 `compose restart elasticsearch`）。

### 1.3 基准事实（PG 实测）

```
                  id                  |     title      | status | lifecycle
--------------------------------------+----------------+--------+-----------
 01a0eda2-6791-7c91-94d3-5ce487616ce2 | 01-doc         | ready  | active
 …（共 13 行，全 ready ∧ active）
(13 rows)
 docs | ready_active
------+--------------
   13 |           13
(1 row)
 gold | runs
------+------
   60 |    3      -- 跑 P 之前
```

- 账本：`artifacts/eval-corpus-ledger-01a0eda2-6781-7ca3-90e8-17dcd7ba68c2.json`（13 条，未被 git 跟踪）。
- 指纹：`c437c632c4785b2f79e704a76eb46ff1bc39d2e1696322d97919280b92f8c1dd`。

### 1.4 CLI 跑法（P / N1 / N3 / N4 共用）

```powershell
. "$env:TEMP\sr-reconcile\sr-env.ps1"
$env:L1_DOC_MAP = 'D:\projects\ai-stared-project\StrictRAG\artifacts\<账本>.json'   # N4 另叠加 $env:L1_GOLD_PATH
pnpm --dir "D:\projects\ai-stared-project\StrictRAG\apps\api" exec tsx src/scripts/run-l1-golden.ts
```

出口约定：账本不可用 → `CorpusLedgerError` → `exit 2`；题源读不到 → `GoldLoadError` → `exit 2`；成功 → 写 `artifacts/l1-last-run.{json,md}` 并 `exit 0`。

---

## 2. P · 正向（真账本 → 通过出报告）

命令同 §1.4，`L1_DOC_MAP` 指原账本。关键输出（`artifacts/l1-last-run.json` 摘录）：

```json
{
  "mode": "live",
  "retrieve_mode": "live",
  "signoffEligible": true,
  "caseCount": 60,
  "answerableCount": 30,
  "unanswerableClassCount": 30,
  "matrix": { "A": 0, "B": 30, "C": 0, "D": 30 },
  "coverage": 0,
  "hitAtK": 1,
  "hitAtKHits": 30,
  "hitAtKScored": 30,
  "docMapSource": "ledger",
  "docMapResolved": 10,
  "docMapUnmappedIds": [],
  "errorCount": 0,
  "repro": {
    "goldSource": "file",
    "goldSetMatchesRepoFile": true,
    "retrieveK": 150,
    "rerankTopN": 20,
    "tauClaim": 0.5,
    "questionIdsHash": "b254152236b6e3f4a2b5af3a75042eb53e5f8dce62931365bb1f599b4469697d",
    "calibrationHash": "fcc66215e04f4c0798e7f33138c002bdabd6f19745363d9dc51dce407ffdb4b6"
  }
}
```

`gateVerdict.businessPass=false`，`reasons`：`missing_proposal · missing_signatures · coverage_zero_or_null · judge_auroc_missing_or_below_min · human_spot_missing · internal_guard` —— 与前图一致，**不含** `hit_at_k_below_min`。

**要点**：
- 对账**通过**、跑完出报告（`exit 0`）。
- `docMapSource=ledger`、`docMapResolved=10`、`docMapUnmappedIds=[]`：（去重后 10 个逻辑 id 全命中）。
- `hitAtK=1`（`30/30`），是真比值，非结构性 0。
- `repro.goldSource='file'`、`repro.goldSetMatchesRepoFile=true`。
- **未设 `L1_MAX_CASES`**，故无截断：`caseCount=60`（30 answerable + 30 unanswerable）。`hitAtKScored=30` 是因为 60 题里只有 30 题带 `expectedDocIds`（另 30 题 `hitAtKCase` 返回 `null`，不进分母）——分母是「有标注题数」，与 `L1_MAX_CASES` 无关。

---

## 3. N1 · missing（账本点到不存在的 docId）

造坏账本：复制原账本 → `artifacts/l1-bad-missing.json`，把 `entries[0].docId` 从 `01a0eda2-6791-7c91-94d3-5ce487616ce2` 改成 `00000000-0000-7000-8000-0000000000ff`（**只改 docId，不动 `logicalId` / `sourceSha256`**）。

```powershell
$orig = Get-Content '…\artifacts\eval-corpus-ledger-01a0eda2-…json' -Raw | ConvertFrom-Json
$orig | ConvertTo-Json -Depth 10 | % { $_ }   # 复制
$m = $orig | ConvertTo-Json -Depth 10 | ConvertFrom-Json
$m.entries[0].docId = '00000000-0000-7000-8000-0000000000ff'
$m | ConvertTo-Json -Depth 10 | Set-Content '…\artifacts\l1-bad-missing.json'
```

CLI 输出（`exit 2`，逐字）：

```
账本与库内文档对不上（KB 01a0eda2-6781-7ca3-90e8-17dcd7ba68c2）：missing=1 not_retrievable=0 title_mismatch=0；明细：[ingest-samples/01-doc→00000000-0000-7000-8000-0000000000ff missing]
```

**指纹档 vs 对账档的自洽性核实**：改 docId / title **不影响**账本内部指纹（`corpusFingerprint` 只吃 `logicalId + sourceSha256`）。直接调用 `parseCorpusLedger` 复核：

```
PARSE_OK l1-bad-missing.json entries=13 fp=c437c632c478
PARSE_OK l1-bad-title.json   entries=13 fp=c437c632c478
```

两文件都仍被 `parseCorpusLedger` 接受 → 上面的报错确实来自**对账**（`diffLedgerAgainstDocs`），而不是「指纹不自洽」。

---

## 4. N2 · not_retrievable（**本图核心**）

用**同一份原账本**，把 KB 内某篇文档临时改成不可检索姿态，再跑 CLI。

### 4.1 lifecycle 一档

```powershell
docker exec strict-rag-postgres psql -U strict_rag -d strict_rag `
  -c "update documents set lifecycle='superseded' where id='01a0eda2-6791-7c91-94d3-5ce487616ce2';"
# → UPDATE 1
$env:L1_DOC_MAP = '…\artifacts\eval-corpus-ledger-01a0eda2-…json'   # 原账本，未改
pnpm --dir "…\apps\api" exec tsx src/scripts/run-l1-golden.ts
```

输出（`exit 2`，逐字）：

```
账本与库内文档对不上（KB 01a0eda2-6781-7ca3-90e8-17dcd7ba68c2）：missing=0 not_retrievable=1 title_mismatch=0；明细：[ingest-samples/01-doc→01a0eda2-6791-7c91-94d3-5ce487616ce2 not_retrievable kbId=01a0eda2-6781-7ca3-90e8-17dcd7ba68c2 title=01-doc status=ready lifecycle=superseded]
```

还原 + select 证明：

```powershell
docker exec strict-rag-postgres psql -U strict_rag -d strict_rag `
  -c "update documents set lifecycle='active' where id='01a0eda2-6791-7c91-94d3-5ce487616ce2';"
# → UPDATE 1
```

```
                  id                  | title  | status | lifecycle
--------------------------------------+--------+--------+-----------
 01a0eda2-6791-7c91-94d3-5ce487616ce2 | 01-doc | ready  | active
(1 row)
```

> **这正是「重跑入库后旧账本仍能查到旧行、却已不可检索」的真实形状**：行还在（`missing=0`）、账本内部自洽、kbId/指纹全对，但该行已 `superseded`。只查「存在」的旧口径会放行，产生假 miss；新闸以**可检索姿态**（`status='ready'` ∧ `lifecycle='active'`）为准，故拒跑。

### 4.2 status 等价一档（做全，非只做一档）

```powershell
docker exec strict-rag-postgres psql -U strict_rag -d strict_rag `
  -c "update documents set status='failed' where id='01a0eda2-6791-7c91-94d3-5ce487616ce2';"
# → UPDATE 1  …… 跑 CLI ……
账本与库内文档对不上（KB 01a0eda2-6781-7ca3-90e8-17dcd7ba68c2）：missing=0 not_retrievable=1 title_mismatch=0；明细：[ingest-samples/01-doc→01a0eda2-6791-7c91-94d3-5ce487616ce2 not_retrievable kbId=01a0eda2-6781-7ca3-90e8-17dcd7ba68c2 title=01-doc status=failed lifecycle=active]
# → 还原 status='ready' → select 证明 status=ready lifecycle=active
```

两档共用同一 `not_retrievable` 判定（`status !== 'ready' || lifecycle !== 'active'`），读数里如实带出实测 `status` / `lifecycle`。

---

## 5. N3 · title_mismatch（账本 title 改一字符）

复制原账本 → `artifacts/l1-bad-title.json`，把 `entries[0].title` 从 `01-doc` 改成 `01-docx`（不动 `logicalId` / `sourceSha256` / `docId`）。CLI 输出（`exit 2`，逐字）：

```
账本与库内文档对不上（KB 01a0eda2-6781-7ca3-90e8-17dcd7ba68c2）：missing=0 not_retrievable=0 title_mismatch=1；明细：[ingest-samples/01-doc→01a0eda2-6791-7c91-94d3-5ce487616ce2 title_mismatch kbId=01a0eda2-6781-7ca3-90e8-17dcd7ba68c2 title=01-doc status=ready lifecycle=active]
```

（该文件同样被 `parseCorpusLedger` 接受，见 §3 的 `PARSE_OK`。）

---

## 6. N4 · 题源不匹配信号（`goldSetMatchesRepoFile`）

### 6.1 改 id 的副本（`exit 0`，信号翻转）

把 `fixtures/l1/gold.yaml` 复制到临时目录，改掉 `cases[0].id`（`l1-ans-001` → `l1-ans-001x`），`L1_GOLD_PATH` 指过去，其余同 P：

```powershell
$g = Get-Content '…\fixtures\l1\gold.yaml' -Raw | ConvertFrom-Json
$g.cases[0].id = 'l1-ans-001x'
$g | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 "$env:TEMP\sr-reconcile\gold-copy.yaml"
$env:L1_GOLD_PATH = "$env:TEMP\sr-reconcile\gold-copy.yaml"
$env:L1_OUT_DIR   = "$env:TEMP\sr-reconcile\out-n4a"
pnpm --dir "…\apps\api" exec tsx src/scripts/run-l1-golden.ts
```

输出摘录：

```
  "caseCount": 60,
  "hitAtK": 1,
  "docMapSource": "ledger",
    "goldSource": "file",
    "goldSetMatchesRepoFile": false
N4a_EXIT=0
```

**读数**：`goldSource` 仍为 `file`（题源仍是文件），但 `goldSetMatchesRepoFile` 翻成 `false` —— 跑批的题面 id 集合与仓内基线不再逐个相同。这是**信号**（如实标注，不进任何判定），不是闸：跑批照常完成。

### 6.2 坏路径（另一档，`exit 2`）

`L1_GOLD_PATH` 指向不存在的路径：

```
cannot read gold file: C:\Users\83960\AppData\Local\Temp\sr-reconcile\does-not-exist.yaml: ENOENT: no such file or directory, open 'C:\Users\83960\AppData\Local\Temp\sr-reconcile\does-not-exist.yaml'
N4b_EXIT=2
```

这是 **gold 加载失败**（`GoldLoadError`）档，**不是** §6.1 的信号档——如实记录两档不同，不混为一谈。

---

## 7. M · 队列侧（`POST /eval/runs` → BullMQ → worker）

配置（进程级注入；api 与 worker 同款 operable env）：

```powershell
$env:EVAL_INTERNAL_TOKEN = 'dev-eval-token-local'   # api 与 worker 相同
# api：  pnpm --dir "…\apps\api" start     （后台）
# worker：pnpm --dir "…\apps\worker" start （后台，另加）
$env:L1_DOC_MAP = 'D:\projects\ai-stared-project\StrictRAG\artifacts\l1-bad-missing.json'
```

`GET /ready` = `{"ready":true,"checks":{"postgres":"up","redis":"up","elasticsearch":"up","gateway":"skipped","s3":"up","mongo":"up"}}`。

用 `evalMw=requirePermission('eval.run')`（**与 AUTH_ENFORCE 无关**，始终要 Bearer），故先 dev-login 拿 super_admin token：

```powershell
$login = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/api/v1/auth/admin/dev-login' -Method Post `
  -ContentType 'application/json' `
  -Body (@{ email='reconcile-m@local.dev'; roleTemplate='super_admin'; tenantId='01900000-0000-7000-8000-000000000001' } | ConvertTo-Json)
$post = Invoke-RestMethod -Uri "http://127.0.0.1:4000/api/v1/knowledge-bases/01a0eda2-6781-7ca3-90e8-17dcd7ba68c2/eval/runs" `
  -Method Post -Headers @{ Authorization = "Bearer $token" } `
  -ContentType 'application/json' -Body (@{ runType='golden_2x2' } | ConvertTo-Json)
```

实测：

```
LOGIN_OK tokenLen=468 userId=01a0f32b-09b5-715f-9871-a1103d5477e6
POST_OK runId=01a0f32b-0a10-7a4a-a37d-f2a3b0cb7c2a jobId=1 status=queued
poll[0] status=failed
FINAL status=failed
```

库内原文（`psql -A` 取 UTF-8，避免控制台码页乱码）：

```
id | status | retrieve_mode | error_message
01a0f32b-0a10-7a4a-a37d-f2a3b0cb7c2a | failed | live | 账本与库内文档对不上（KB 01a0eda2-6781-7ca3-90e8-17dcd7ba68c2）：missing=1 not_retrievable=0 title_mismatch=0；明细：[ingest-samples/01-doc→00000000-0000-7000-8000-0000000000ff missing]
```

worker 日志同一条：

```
service: "worker"  jobId: "1"
err: { "type": "Error", "message": "账本与库内文档对不上（KB 01a0eda2-6781-7ca3-90e8-17dcd7ba68c2）：missing=1 not_retrievable=0 title_mismatch=0；明细：[ingest-samples/01-doc→00000000-0000-7000-8000-0000000000ff missing]" … }
  at Worker … apps\worker\src\index.ts:119:15
```

**读数**：job 落 `status=failed`，`error_message` 是**对账**那条（含 `missing=1` 与逐条明细），**不是**前图既有的「kbId 不符 / 指纹不符」那条。worker 侧账本设置但不可用 → 响亮失败，未降级成「未设置」。跑完已把 api + worker 两个后台任务 kill。

---

## 8. 留痕（`artifacts/` 已 gitignore，为便于本机复核列出）

| 路径 | 内容 |
|------|------|
| `artifacts/eval-corpus-ledger-01a0eda2-6781-7ca3-90e8-17dcd7ba68c2.json` | 原账本（13 条）**未改** |
| `artifacts/l1-bad-missing.json` | N1 / M 用的坏账本（entry0 docId → `0000…00ff`）—— **留痕不删** |
| `artifacts/l1-bad-title.json` | N3 用的坏账本（entry0 title → `01-docx`）—— **留痕不删** |
| `artifacts/l1-last-run.json` / `.md` | P 的报告 |
| `%TEMP%\sr-reconcile\gold-copy.yaml`、`out-n4a\`、`out-n4b\` | N4 的题源副本与输出（临时目录，不在仓内） |

M 的失败行：`eval_runs.id=01a0f32b-0a10-7a4a-a37d-f2a3b0cb7c2a`（可直接 select 复核）。

---

## 9. 未做 / 未核实（逐条）

- **未核实 N2 的「真重跑入库」全链**：本轮用 `psql update` 直接改姿态来复现「旧行仍在却不可检索」，**未**真走一遍「重新入库产生新 docId + 旧行 superseded」的入库状态机。形状等价，但来源不同，据实声明。
- **未接真 Gateway / 真向量**：chat/embed 仍 mock → `coverage=0`、60 题可答类全 `abstained`、`judgeAuroc=null`、`humanSpot=null`。**本页 `hitAtK` 只说明「映射面通了」，不说明检索质量，不得进签字包**。
- **ES 分词**：vanilla 8.15.3 无 IK，命中数能被账本解释，不代表生产分词效果。
- **M 只跑了 L1（`golden_2x2`）**：未跑 L2 队列路径；worker 侧 L2 的账本接线源码同构但本轮未实测。
- **N4 的信号档只在 api CLI 实测**：worker 队列侧的 `goldSetMatchesRepoFile` 本轮未验（题源差异是信号、非闸）。

---

## 10. 收尾核对

**① 文档姿态已还原**（无任何非 `ready`/`active` 行；全 13 篇齐备）：

```
 id | title | status | lifecycle
----+-------+--------+-----------
(0 rows)
 total | ready_active
-------+--------------
    13 |           13
(1 row)
```

**② 无遗留后台进程**：`Get-Process -Name node` → 空；`netstat :4000` → 仅 4 条 `TIME_WAIT`（无 LISTENING），api/worker 均已停。

```
=== node 进程 ===
(空)
=== 端口 4000 ===
  TCP 127.0.0.1:7496  127.0.0.1:4000  TIME_WAIT  0
  TCP 127.0.0.1:10487 127.0.0.1:4000  TIME_WAIT  0
  TCP 127.0.0.1:10488 127.0.0.1:4000  TIME_WAIT  0
  TCP 127.0.0.1:13988 127.0.0.1:4000  TIME_WAIT  0
```

**③ `git status --porcelain`**：本轮结束时仅剩本文件（`.scratch/eval-input-baseline/research/05-real-stack-reconcile.md`）；`artifacts/` 产物被 gitignore、不出现。未做任何 `git commit` / `git push`。
