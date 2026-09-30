# 04 · 真栈真跑：无 key 机器上拉起 → 末步给出可解释结果

> wayfinder 图 `half-ask-reproducible` 工单 04 的研究文。
> **只读**仓库源码；运行产物只写 `artifacts/`（已 gitignore）与临时目录；**未改**仓库源码 / 脚本 / 测例 / `.env` / `prds/` / `fixtures/`；**未** `git commit` / `git push`。
> 本页是**工程管道取证**，不是质量证据、不是签字数字（口径见末节）。

---

## 0. 环境与口径

| 项 | 值 |
|---|---|
| 时间 | 2026-10-01 01:00–01:02（+0800） |
| 中间件 | compose 五服务 **healthy**（未重启、未清库）：postgres / redis / elasticsearch / mongo / rustfs |
| PG 既有数据 | 未清库（复用前图留下的库） |
| api 起法 | `pnpm --dir 'D:\projects\ai-stared-project\StrictRAG\apps\api' start`（`tsx src/index.ts`，**不经 turbo**） |
| worker 起法 | `pnpm --dir 'D:\projects\ai-stared-project\StrictRAG\apps\worker' start`（同上） |
| 桩起法 | `node scripts/stub-gateway.mjs`（独立进程，默认 :4100） |

`docker compose ps`（逐字）：

```
SERVICE         STATUS                    PORTS
elasticsearch   Up 30 minutes (healthy)   0.0.0.0:9200->9200/tcp, 9300/tcp
mongo           Up 30 minutes (healthy)   0.0.0.0:27017->27017/tcp
postgres        Up 30 minutes (healthy)   0.0.0.0:5432->5432/tcp
redis           Up 30 minutes (healthy)   0.0.0.0:6379->6379/tcp
rustfs          Up 30 minutes (healthy)   0.0.0.0:9000-9001->9000-9001/tcp
```

**env 注入方式**：仓库根 `.env` **保持 `.env.example` 默认**（`GATEWAY_BASE_URL=` 空 · `STORAGE_MODE=local` · `INGEST_ES_MODE=mock`），**未改**。真栈所需 operable 变量由**进程级 env** 注入（`dotenv` 不覆盖已有进程 env，故进程级胜出）：

```
ELASTICSEARCH_URL=http://127.0.0.1:9200  RETRIEVE_ES_MODE=http  INGEST_ES_MODE=http
INGEST_SCAN_MODE=mock_clean  INGEST_EMBED_MODE=mock  STORAGE_MODE=s3
S3_ENDPOINT=http://127.0.0.1:9000  S3_ACCESS_KEY=strict_rag  S3_SECRET_KEY=strict_rag_secret  S3_BUCKET=strict-rag
MONGODB_URL=mongodb://127.0.0.1:27017/strict_rag
AUTH_ENFORCE=false  DEPT_ACL_ENFORCE=false  SESSION_REWRITE_ENABLED=false  TAU_CLAIM=0.5
```

`GATEWAY_MODE` **始终未设**。A 跑**不设** `GATEWAY_BASE_URL`；B 跑设 `GATEWAY_BASE_URL=http://127.0.0.1:4100`。

api 启动日志（A 跑，逐字节选）：`api listening on http://127.0.0.1:4000 … gatewayConfigured: false`。
api 启动日志（B 跑，逐字节选）：`api listening on http://127.0.0.1:4000 … gatewayConfigured: true`。
worker 启动日志（逐字节选）：`worker running … scanMode: "mock_clean" esMode: "http" embedMode: "mock" storageMode: "s3" ocrEnabled: false`。

---

## A · 无 Gateway 时的现状复验（**预期失败**，如实记录）

命令：

```pwsh
Set-Location 'D:\projects\ai-stared-project\StrictRAG'
Remove-Item Env:GATEWAY_BASE_URL -ErrorAction SilentlyContinue
pnpm smoke:half
Write-Output "SMOKE_EXIT=$LASTEXITCODE"
```

输出（逐字）：

```
> strict-rag@0.0.0 smoke:half D:\projects\ai-stared-project\StrictRAG
> node scripts/smoke-half.mjs

HALF-SMOKE → http://127.0.0.1:4000
progress status=uploaded embed=false es=false
progress status=ready embed=true es=true
 ELIFECYCLE  Command failed with exit code 1.
FAIL: ask has no citations: {"ok":true,"data":{"requestId":"adde2cae-e697-4d6d-8388-27fe987415af","status":"abstained","answer":"","citations":[],"reason":"internal_guard","userMessage":"服务暂时无法完成可靠回答。","suggestedActions":[{"type":"retry_later","label":"稍后重试"}],"latencyMs":75,"mode":"balanced","sessionId":null},"meta":{"requestId":"adde2cae-e697-4d6d-8388-27fe987415af","timestamp":"2026-10-01 01:00:25"}}
[诊断] 末步（第 8 步）ask 未拿到引用。
[诊断] 末步需要 chat 的三条 JSON（generate / claim_split / judge）；本机未配 Gateway（/ready checks.gateway=skipped）→ 见 docs/ops/half-smoke.md；也可用 dev-only 桩：`node scripts/stub-gateway.mjs` + `GATEWAY_BASE_URL=http://127.0.0.1:4100`。
SMOKE_EXIT=1
```

**读数（与工单 01 的基线一致）**：

- 第 1–7 步全过（`status=ready embed=true es=true`），**只有末步（第 8 步）失败**；退出码 **1**。
- 失败断言同前：`askHasCitations` 要求 `status='answered'` 且引用带 `docId`；本跑 `status='abstained'` / `citations=[]` → 失败。HTTP 码仍是 **200**（业务态）。
- **新版可诊断提示已出现**（工单 03 的落点生效）：`[诊断] 末步需要 chat 的三条 JSON（generate / claim_split / judge）；本机未配 Gateway（/ready checks.gateway=skipped）→ 见 docs/ops/half-smoke.md；也可用 dev-only 桩…` —— 一句话点破了「缺 Gateway / 缺哪三条契约 / 看哪份文档 / 怎么用桩」。
- **默认行为与改动前一致**：同样第 8 步失败、同样 `reason=internal_guard`、同样 `exit 1`；未放宽任何闸、未伪造绿。
- `ELIFECYCLE` 与 `FAIL` 两行的先后是 stderr/stdout 交织，不影响读数。

> 附：`GET /ready`（无 Gateway）逐字：`{"service":"api","ready":true,"checks":{"postgres":"up","redis":"up","elasticsearch":"up","gateway":"skipped","s3":"up","mongo":"up"}}`（`gateway=skipped`，软依赖，`ready` 仍 `true`）。

---

## B · 用桩跑通（本图的 DoD）

### B1 · 桩启动 banner（逐字）

命令：`node scripts/stub-gateway.mjs`

```
================================================================
 dev-only 桩网关 · strict-rag-stub
 · 只证明管道接对，不是质量证据，不得进签字包
 · 只从提示里的 EVIDENCE 抽取；证据不足即 insufficient:true
 · 生产档位（APP_ENV/NODE_ENV=production）拒绝启动
 · 监听 http://127.0.0.1:4100 · embed dims=8
================================================================
[stub-gateway] listening on http://127.0.0.1:4100
```

（记录方式：桩 stdout 经 `cmd /c "… > file 2>&1"` 原字节落盘，`read_file` 按 UTF-8 读出，故为逐字。若直接经 PowerShell `Tee-Object` 管道，中文会因控制台代码页被二次编码成乱码——**这是采集侧编码问题，不是桩缺陷**；直接跑 `node scripts/stub-gateway.mjs` 时终端显示正常。）

身份端点自证：`GET http://127.0.0.1:4100/__stub` →
`{"stub":true,"version":"1","purposes":["generate","claim_split","judge","embed","rerank"]}`。

### B2 · `pnpm smoke:half`（`GATEWAY_BASE_URL` 指向桩）

命令：

```pwsh
$env:GATEWAY_BASE_URL='http://127.0.0.1:4100'
pnpm smoke:half
```

退出码 **0**。输出（逐字）：

```
> strict-rag@0.0.0 smoke:half D:\projects\ai-stared-project\StrictRAG
> node scripts/smoke-half.mjs

HALF-SMOKE → http://127.0.0.1:4000
gateway=stub（dev-only 桩 · 仅证明管道接对 · 非质量证据）
progress status=uploaded embed=false es=false
progress status=ready embed=true es=true
PASS kbId=01a0f343-294f-7cbc-9738-9363b94dad09 docId=01a0f343-2962-7ac0-ba74-6e9d26e049ad citations=2 (gateway=stub · 仅证明管道接对 · 非质量证据)
NOTE: mock retrieve/scan allowed; not production ES; not QUAL-2.
```

**读数**：`PASS` 且 `citations=2 ≥ 1`；输出**两处**能看出用的是桩 —— 开跑即打 `gateway=stub（dev-only 桩 · 仅证明管道接对 · 非质量证据）`，`PASS` 行尾部再带 `(gateway=stub · 仅证明管道接对 · 非质量证据)`。桩身份来自脚本对 `GET {base}/__stub` 的探测（真网关会 404，不会误标）。

### B3 · 这一跑 `POST /ask` 的响应体（带 `debug:true` 复现）

对同一 KB（`01a0f343-294f-7cbc-9738-9363b94dad09`）以 `half-smoke@local.dev`（super_admin）重发同一问题，`options:{stream:false, debug:true}`：

```json
{
  "ok": true,
  "data": {
    "requestId": "ad3fd57a-4172-43c9-8cc7-cad1e23f7e79",
    "status": "answered",
    "answer": "第二节说明检索闸仅对 ready 且 active 文档生效，draft 与 superseded 不得进入默认检索集合这是第 01 篇企业制度样例正文，用于 Phase 1 入库演示与双就绪验收",
    "answerKind": "knowledge",
    "citations": [
      { "chunkId": "01a0f343-2a15-72bd-8247-badd69218722", "docId": "01a0f343-2962-7ac0-ba74-6e9d26e049ad", "title": "01-doc", "preview": "第二节说明检索闸仅对 ready 且 active 文档生效，draft 与 superseded 不得进入默认检索集合。", "lifecycle": "active" },
      { "chunkId": "01a0f343-2a10-7467-b78f-48ccfc7dbe0e", "docId": "01a0f343-2962-7ac0-ba74-6e9d26e049ad", "title": "01-doc", "preview": "这是第 01 篇企业制度样例正文，用于 Phase 1 入库演示与双就绪验收。内容需要足够长度以通过最小抽取字符阈值。", "lifecycle": "active" }
    ],
    "minSupport": 0.532608695652174,
    "reason": "verified",
    "userMessage": "第二节说明检索闸仅对 ready 且 active 文档生效，draft 与 superseded 不得进入默认检索集合这是第 01 篇企业制度样例正文，用于 Phase 1 入库演示与双就绪验收",
    "suggestedActions": [ { "type": "view_citations", "label": "查看引用" } ],
    "latencyMs": 59,
    "mode": "balanced",
    "sessionId": null,
    "debug": {
      "llmCalls": 3, "retrieveCalls": 1,
      "route_source": "rule_knowledge", "routeLabel": "single",
      "evidenceCount": 2,
      "rewriteUsed": false, "sessionDeepened": false,
      "documentBackref": false, "externalBackref": false,
      "backReference": "none", "sessionRewriteEnabledDefault": false
    }
  },
  "meta": { "requestId": "ad3fd57a-4172-43c9-8cc7-cad1e23f7e79", "timestamp": "2026-10-01 01:01:15" }
}
```

**读数**：`status=answered` · `reason=verified` · `citations=2` · `minSupport=0.5326…`（= 桩 judge 分数）· `debug.llmCalls=3`（generate + claim_split + judge 三次 chat）· `debug.evidenceCount=2`（检索拿到 2 块证据）· `retrieveCalls=1`。

### B4 · citations 的 chunkId 是否真属于该文档（psql 核）

命令：

```pwsh
docker exec strict-rag-postgres psql -U strict_rag -d strict_rag -c "select id, doc_id, ordinal, left(coalesce(body_text, preview), 60) as snippet from chunks where doc_id='01a0f343-2962-7ac0-ba74-6e9d26e049ad' order by ordinal;"
```

输出（逐字）：

```
                  id                  |                doc_id                | ordinal |                                                  snippet
--------------------------------------+--------------------------------------+---------+-----------------------------------------------------------------------------------------------------------
 01a0f343-2a10-7467-b78f-48ccfc7dbe0e | 01a0f343-2962-7ac0-ba74-6e9d26e049ad |       0 | 这是第 01 篇企业制度样例正文，用于 Phase 1 入库演示与双就绪验收。内容需要足够长度以通过最小抽取字符阈值。
 01a0f343-2a15-72bd-8247-badd69218722 | 01a0f343-2962-7ac0-ba74-6e9d26e049ad |       1 | 第二节说明检索闸仅对 ready 且 active 文档生效，draft 与 superseded 不得进入默认检索集合
(2 rows)
```

**逐条核对**：

| ask 返回的 chunkId | psql 里该 id 的 doc_id | 归属 |
|---|---|---|
| `01a0f343-2a15-72bd-8247-badd69218722` | `01a0f343-2962-7ac0-ba74-6e9d26e049ad`（ordinal 1） | ✅ 属于本跑入库的文档 |
| `01a0f343-2a10-7467-b78f-48ccfc7dbe0e` | `01a0f343-2962-7ac0-ba74-6e9d26e049ad`（ordinal 0） | ✅ 属于本跑入库的文档 |

两条引用的 `docId` 均等于本跑 `PASS` 行里的 `docId`；chunk 正文与引用 `preview` 逐字相符。

### B5 · 桩实际收到的 purpose 序列（桩 stdout 逐字）

```
[stub-gateway] purpose=__stub identity
[stub-gateway] purpose=models list
[stub-gateway] purpose=models list
[stub-gateway] purpose=__stub identity
[stub-gateway] purpose=embed count=1 dims=8
[stub-gateway] purpose=rerank docs=2 results=2
[stub-gateway] purpose=generate {"answer":"第二节说明检索闸仅对 ready 且 active 文档生效，draft 与 superseded 不得进入默认检索集合这是第 01 篇企业制度样例正文，用于 Phase 1 入库演示与双就绪验收","citations":["01a0f343-2a15-72bd-8247-badd6921872
[stub-gateway] purpose=claim_split {"claims":[{"text":"第二节说明检索闸仅对 ready 且 active 文档生效，draft 与 superseded 不得进入默认检索集合这是第 01 篇企业制度样例正文，用于 Phase 1 入库演示与双就绪验收","chunkIds":["01a0f343-2a15-72bd-8247-bad
[stub-gateway] purpose=judge {"scores":[0.532608695652174]}
[stub-gateway] purpose=embed count=1 dims=8
[stub-gateway] purpose=rerank docs=2 results=2
[stub-gateway] purpose=generate {"answer":"第二节说明检索闸仅对 ready 且 active 文档生效，draft 与 superseded 不得进入默认检索集合这是第 01 篇企业制度样例正文，用于 Phase 1 入库演示与双就绪验收","citations":["01a0f343-2a15-72bd-8247-badd6921872
[stub-gateway] purpose=claim_split {"claims":[{"text":"第二节说明检索闸仅对 ready 且 active 文档生效，draft 与 superseded 不得进入默认检索集合这是第 01 篇企业制度样例正文，用于 Phase 1 入库演示与双就绪验收","chunkIds":["01a0f343-2a15-72bd-8247-bad
[stub-gateway] purpose=judge {"scores":[0.532608695652174]}
[stub-gateway] purpose=rerank docs=2 results=2
```

**读数**：两次 ask 各产生一轮 `embed → rerank → generate → claim_split → judge`。**chat 三条的 purpose 序列正是 `generate → claim_split → judge`**（与工单 01 推定的确定性序列一致）；检索内的 `embed` / `rerank` 各一次、剂量正确（`embed count=1`、`rerank docs=2 results=2`）。日志行被桩自身截断到 160 字符（`…slice(0,160)`），故 JSON 尾被截。

### B6 · 桩返回的 generate content 是否「逐字来自 EVIDENCE、不许编」

桩只做**句级抽取**：`generate()` 取每块 EVIDENCE 里与问题 token 重叠度最高的句子，拼成 `answer`，`citations` 逐字取该 EVIDENCE 行的 `chunkId`。核对：

- `answer` = `第二节说明检索闸仅对 ready 且 active 文档生效，draft 与 superseded 不得进入默认检索集合` + `这是第 01 篇企业制度样例正文，用于 Phase 1 入库演示与双就绪验收`
  - 这两句**逐字**来自夹具 `fixtures/ingest-samples/01-doc.txt` 的正文（仅去掉了句末 `。`，因为桩按 `。！？!?；;\n` 切句）；
  - 也与 psql 里两块 chunk 的正文逐字相符（见 B4 表）。
- `citations` = `["01a0f343-2a15-72bd-8247-badd69218722", "01a0f343-2a10-7467-b78f-48ccfc7dbe0e"]` —— 这两个 id **逐字**取自 EVIDENCE 头行 `[0] chunkId=… / [1] chunkId=…`，且经 psql 确认真属该文档（见 B4）。
- `claim_split` 的 `chunkIds` ⊂ 上一步 `citations`；`judge` 的 `scores=[0.532608695652174]` 长度=claims 数（1 条），且 ≥ `TAU_CLAIM`（0.5），故 api 判 `verified`。

**结论**：本跑答案完全由桩从 EVIDENCE 抽取，未见任何编造 chunkId 或凭空生成。

---

## C · 反证

### C1 · 生产护栏（桩必须拒绝启动）

命令（清掉后即删该 env）：

```pwsh
$env:APP_ENV='production'
node scripts/stub-gateway.mjs
```

退出码 **1**。stderr（逐字）：

```
[stub-gateway] 拒绝启动：检测到生产档位 (APP_ENV=production NODE_ENV=unset)。本桩是 dev-only 抽取式假网关，只证明管道接对，不得在生产环境运行。
```

跑完 `Remove-Item Env:APP_ENV`。**通过**：桩在生产档位下拒绝启动。

### C2 · 「不许编答案」反证

**先试 pipeline 级（语料外问题 → 期望 `abstained`）**，做了多次构造，如实记录：

| 问题 | 结果 |
|---|---|
| `火星表面平均温度是多少？` | `answered` / `verified` / `citations=1` —— **未 abstain** |
| `为什么鲸鱼会集体搁浅` | `answered` / `verified` / `citations=1` —— **未 abstain** |
| `蓝鲸究竟为何集体冲上沙滩` | `answered` / `verified` / `citations=1` —— **未 abstain** |
| `鲸鱼搁浅的原因` | **`abstained` / `model_abstained` / `citations=0`** ✅ |

机制（重要，非缺陷但是限制）：检索侧（mock 向量 + 真 ES）在只有一篇 active 文档时**总会**返回该文档的 2 块证据；桩的匹配是 **CJK 单字 + 相邻双字** 级别的 token 重叠，只要问题与证据**共享任意一个字**（如「集体」的 `集` 命中「集合」），即判为有重叠并抽句作答。因此只有**真正零重叠**的问句（`鲸鱼搁浅的原因`）才会让桩回 `insufficient:true`。这暴露了桩「证据不足」分支的**触发面很窄**——它是抽取式、不编造，但可能把无关问题答成一条弱相关的原文句。

`鲸鱼搁浅的原因` 这一跑的响应（逐字）：

```json
{
  "ok": true,
  "data": {
    "requestId": "e0775540-d1e8-4fdd-a181-bf480ec915f4",
    "status": "abstained",
    "answer": "",
    "citations": [],
    "reason": "model_abstained",
    "userMessage": "证据不足，无法可靠回答。",
    "suggestedActions": [ { "type": "rephrase", "label": "换种问法" }, { "type": "feedback_missing_doc", "label": "反馈缺文档" } ],
    "latencyMs": 40,
    "mode": "balanced",
    "sessionId": null,
    "debug": { "llmCalls": 1, "retrieveCalls": 1, "route_source": "rule_knowledge", "routeLabel": "single", "evidenceCount": 2, "rewriteUsed": false, "sessionDeepened": false, "documentBackref": false, "externalBackref": false, "backReference": "none", "sessionRewriteEnabledDefault": false }
  },
  "meta": { "requestId": "e0775540-d1e8-4fdd-a181-bf480ec915f4", "timestamp": "2026-10-01 01:01:54" }
}
```

**读数**：桩回 `insufficient:true` 后，api 走 `status=abstained` / `reason=model_abstained`（`citations=[]`），`llmCalls=1`（只发了 generate 就停），`evidenceCount=2`（检索仍有证据，但模型侧说不充分）。**没有**被桩编出一个 `answered`。

**等价反证（无 EVIDENCE 的 chat 请求）**：直接向桩发一条 `QUESTION:` 但 `EVIDENCE:` 为空的 `generate` 请求：

```pwsh
$sys = '你是严谨的知识库问答器。只输出 JSON：{"answer":"...","citations":["chunkId"],"insufficient":false}'
$usr = "QUESTION:`n火星表面平均温度是多少？`n`nEVIDENCE:`n（无）"
$body = @{ model='stub'; messages=@(@{role='system';content=$sys}, @{role='user';content=$usr}) } | ConvertTo-Json -Depth 6
Invoke-WebRequest -Uri 'http://127.0.0.1:4100/chat/completions' -Method Post -ContentType 'application/json' -Body $body
```

响应（HTTP **200**，逐字）：

```
{"choices":[{"message":{"content":"{\"answer\":\"\",\"citations\":[],\"insufficient\":true}"}}]}
```

即桩在**无 EVIDENCE** 时必然回 `{"answer":"","citations":[],"insufficient":true}`，**不编答案**。✅

---

## D · 前置清单复核（对照 `docs/ops/half-smoke.md` 与 `docs/ops/operable-stack.md`）

### D1 · 三条已知暗礁是否都在文档里

| 暗礁 | 是否已写 | 落点 |
|---|---|---|
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` 必配（否则 api 起不来） | ✅ 两处 | `operable-stack.md` §2（「全新库必须再配一个超管引导」）；`half-smoke.md` 前置 §2（「**全新库**还须先按 operable-stack §2 配…」） |
| 四眼审批需**第二身份**（自审必 403） | ✅ | `half-smoke.md` 步骤表第 5 行（「自审必 403 → 换 `half-smoke-reviewer@local.dev`（kb_admin）再 approve」+ ADR-048 #4）；`real-stack-evidence.md` §2.2 记了脚本为何改 |
| turbo `dev` 任务的 env 白名单坑 | ✅ | `operable-stack.md` §6.1（`pnpm dev:api` 经 turbo 被过滤 operable 变量；绕法 = 不经 turbo，`pnpm up:apps` 不受影响）；`real-stack-evidence.md` 末段复述 |

三条**均已入文档**，无缺失。本跑全程用「不经 turbo」的 `pnpm --dir … start`，未见该坑。

### D2 · 仍缺 / 仍可能绊倒第三人的点（逐条）

1. **`half-smoke.md` 前置未显式写「必须先追加以 `.env.operable.example`（否则 api/worker 落回 mock/local，真栈不成立）」**。今天只以链接指向 `operable-stack.md` §2；而 `half-smoke.md` 正文又写「扫描 / 向量 / ES 可为 mock」，第三人只读 half-smoke 时**容易**带着默认 mock `.env` 直接 `pnpm up:apps`，把「真栈」跑成 mock 栈而不自知。建议在 half-smoke 前置加一行并给 `/ready` 期望值。
2. **`half-smoke.md` 前置未点明脚本强依赖 `POST /api/v1/auth/admin/dev-login`**，而该端点要求 `APP_ENV=development` 且 `AUTH_ENFORCE` 保持默认关。第三人若按试点口径打开 `AUTH_ENFORCE=true`，`smoke:half` 会在第 2 步（登录）直接失败，而不是跑到末步——文档只在步骤表写了一句「超管可 ask」，没有把它列为前置。
3. **命令示例与本机 shell 不符**：文档给的是 bash 风格 `GATEWAY_BASE_URL=http://127.0.0.1:4100 pnpm smoke:half`。本机是 Windows/PowerShell，这种 `VAR=value cmd` 前缀**不生效**（须 `$env:GATEWAY_BASE_URL='…'` 后再跑）。`operable-stack.md` §6 记了 `pnpm --filter` 的 PowerShell 坑，却**没记**这一条；第三人照抄桩配方会拿到「桩没接上」的假象。
4. **无「确认 api / worker 已就绪」的可核命令**（除 `curl /ready`）。且 `half-smoke.md` 只在「可核命令」里给了 `gateway` 一项，未说明 `/ready.gateway=skipped` ≠ ask 可用（软依赖）；第三人易把 `ready=true` 误读成「问答可用」。
5. **`.env` 里遗留的空 `GATEWAY_BASE_URL=` 与进程级 env 的优先级未说明**：`dotenv` 不覆盖进程 env，故 `$env:GATEWAY_BASE_URL=…` 能盖住 `.env` 的空值；文档未点破，第三人可能误以为必须去改 `.env`（有误提交风险）。

（以上 5 条均为**文档缺口**，非源码缺陷；1/3 在本机实测中确实构成绊脚点。）

---

## 收尾证据

**后台进程已全部停掉**：

```
---node processes---
(none)
---ports---
4000 free
4100 free
```

**`git status --porcelain`**：

```
 M .scratch/fog-inventory-2026-09-23.md
 M docs/module-status/README.md
 M docs/ops/operable-stack.md
```

> 说明：上面三个 `M` **不是本工单产生的**（我全程只读这些文件）——它们在本轮开工前就已是改动状态（前面工单 03 的落地物）。我**唯一**要写的仓内文件是本页 `.scratch/half-ask-reproducible/research/04-real-stack-half-ask.md`（写本页后 `git status` 会多出这一条未跟踪项）。`artifacts/` 产物被 `.gitignore`（第 16 行）忽略，**未出现**在 status 里。

**运行产物留痕**（`artifacts/half-ask-logs/`，gitignored，便于本机复核）：

- `api-A.log` / `api-B.log` / `worker-A.log`
- `stub-B.log`（banner + purpose 序列）/ `stub-production.log`（拒绝启动）
- `smoke-B.log`（PASS 逐字）
- `ask-B.json`（answered 取证）/ `ask-abstain.json`（model_abstained 取证）/ `ask-outofcorpus.json` / `ask-whale.json`
- `chunks-psql2.txt`（chunkId 归属核）
- `stub-noevidence.json`（无 EVIDENCE → insufficient）

---

## mock / 桩口径声明（必须显式）

- 本页 B/C 段所有 `answer` 由 **dev-only 抽取式桩**（`scripts/stub-gateway.mjs`）产出：它只从提示里的 EVIDENCE 抽取句子、`citations` 逐字取 EVIDENCE 行，**不产生任何模型语义**。
- 检索侧为 **mock 向量（`INGEST_EMBED_MODE=mock`，8 维）+ mock embed/rerank**（或桩的确定性伪向量），仅 ES sparse 走**真 ES**（vanilla 8.15.3，无 IK）。
- 因此：**`smoke:half PASS` 只证明「管道接对了」（上传→审批→scan→双就绪→active→ask 取到引用），不是 RAG 质量证据、不是签字数字、不得进签字包**。桩的每一步输出都带 `gateway=stub · 仅证明管道接对 · 非质量证据` 标注，且在生产档位拒绝启动。
- 本页任何 `minSupport` / `citations` / `latencyMs` 数字均**不得**写入签字页。
