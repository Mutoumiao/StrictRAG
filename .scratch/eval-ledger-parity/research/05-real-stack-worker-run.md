# 真栈实测：worker 队列路径接账本后的落库形状与三态

> wayfinder 图 `eval-ledger-parity` 工单 05 的取证。
> **本页任何数字都不是签字数字**：向量仍 mock（dims=8）、chat 仍 mock（无 `GATEWAY_BASE_URL`）、ES 是 vanilla 8.15.3 无 IK、60 题中可答类全 `abstained`（`coverage=0`）。`retrieve_mode=live` 只反映 ES 检索档位。

## 1. 为什么要跑这一趟

`eval_runs` 是 P2.5 准出「报告归档」的载体之一 —— 运营台与 `GET /knowledge-bases/:kbId/eval/runs/:runId` 都从这里读。工单 01 核实的事实：worker 队列路径（`POST /eval/runs` → BullMQ `sr-eval` → `handleEvalJob` → `runL1Batch` → `evalPersist.saveReport`）在 `hitAtKCase` 处直比「夹具逻辑 id vs `documents.id` uuid」，故 `hitAtK` **结构性恒 0**；更关键的是，**这条链此前从未被端到端跑过** —— api 侧测试注入假 `enqueue`，worker 侧测试注入内存 persist，中间的 BullMQ / 真 PG / 真 HTTP 无人贯通。

所以本次取证同时是这张图的一个**首次**：第一次让「运营台发起 → 队列 → worker → 落库」在真栈上闭环。

## 2. 环境

| 项 | 值 |
|---|---|
| compose 五服务 | postgres / redis / elasticsearch 8.15.3 / mongo / rustfs —— 全部 healthy |
| 端口 | 9200 / 5432 / 6379 / 27017 / 9000 |
| 迁移 | `pnpm db:migrate` 成功（命名卷持久，本轮复用既有数据） |
| api | `tsx watch src/index.ts`，`/ready` = `{postgres:up, redis:up, elasticsearch:up, s3:up, mongo:up, gateway:skipped}` |
| worker | `tsx watch src/index.ts`；启动日志 `queues=[sr-probe,sr-ingest,sr-eval] scanMode=mock_clean esMode=http embedMode=mock storageMode=s3 ocrEnabled=false` |
| env 注入方式 | **进程级注入**（`sr-env.ps1` dot-source 后起进程），**未修改仓库 `.env`** |
| 批跑档位 | `RETRIEVE_ES_MODE=http` → 报告 `retrieve_mode=live` |

### 本轮踩到的三个环境坑（都不是仓库缺陷，但会打断真跑）

1. **`pnpm dev:api` 起不来 operable env**：`dev:api` 走 `turbo run dev`，而 `turbo.json` 的 `dev` 任务 env 白名单只有 6 个键（`APP_ENV` / `API_BASE_URL` / `DATABASE_URL` / `REDIS_URL` / `NEXT_PUBLIC_APP_ENV` / `NEXT_PUBLIC_API_BASE_URL`），turbo 的 strict env 模式把 `ELASTICSEARCH_URL` / `STORAGE_MODE` / `SUPER_ADMIN_EMAIL` 等**全部过滤掉** → api 以 mock/local 起来（`/ready` 里 es/s3/mongo 全 `skipped`）。**绕法**：不经 turbo 起（`pnpm --dir apps/api dev`）；官方配方 `pnpm up:apps` 用的是 `pnpm --filter <pkg> start`，**同样不经 turbo**，故不受影响。
2. **`pnpm --filter @strict-rag/api` 经 `.cmd` 传参失败**：包名里的 `@` 与 `--filter` 在 PowerShell 调 `pnpm.cmd` 时被 shell 拼接破坏（报 `Unknown option: 'filter @strict-rag/api dev'`）。**绕法**：用 `pnpm --dir <绝对路径> <script>`。
3. **Docker Desktop 自退 1 次 + ES 端口转发丢失**：Docker 重启后五服务都 healthy，但 host 侧 **9200 无监听**（容器内 `_cluster/health` 正常返回 `yellow`，`docker compose ps` 也显示 `0.0.0.0:9200->9200/tcp`）。**绕法**：`docker compose restart elasticsearch` 后端口 9 秒内恢复。这一条只影响 ES，PG/Redis/Mongo/S3 的转发在 Docker 重启后正常重建。

## 3. 语料入库与账本

| 项 | 值 |
|---|---|
| 入口 | `apps/api/src/scripts/ingest-eval-corpus.ts`（`INGEST_KB_NAME=eval-corpus-kb-l5`） |
| kbId | `01a0eda2-6781-7ca3-90e8-17dcd7ba68c2` |
| 语料 | 13 篇（`fixtures/ingest-samples/*.txt` 10 + `fixtures/l2/corpus/*.txt` 3） |
| 账本 | `artifacts/eval-corpus-ledger-01a0eda2-6781-7ca3-90e8-17dcd7ba68c2.json`（13 条） |
| 语料指纹 | `c437c632c4785b2f79e704a76eb46ff1bc39d2e1696322d97919280b92f8c1dd`（与上一图**同一指纹** —— 夹具未变） |
| 文档状态 | 13/13 `status=ready ∧ lifecycle=active`，`esReady=true` `embedReady=true` |

题库：把 `fixtures/l1/gold.yaml` 的 60 题经 `POST /knowledge-bases/:kbId/gold-questions` 灌进 DB（worker 侧从 `gold_questions` 表读题，与 api CLI 读 `fixtures/l1/gold.yaml` 是**两条不同的题源**）。灌题时首次 30 题因把 `expectedDocIds` 显式传 `null` 被 schema 拒（`Invalid input: expected array, received null`）；改成**省略该字段**后 60/60 全部入库（30 带标注 + 30 无标注）。

## 4. 三态对照（唯一变量 = worker 的 `L1_DOC_MAP`）

三条 run 都是 `POST /knowledge-bases/<kbId>/eval/runs`（`runType=golden_2x2`）→ 队列 → worker 消费。worker 每次以不同的 `L1_DOC_MAP` 重启（env 是模块加载期快照，换路径须重启 —— 这正是裁定 2 记录的行为边界）。

| # | worker 的 `L1_DOC_MAP` | runId | `status` | `caseCount` | `hitAtK`（hits/scored） | `docMapSource` | `docMapResolved` | `errorCount` | `errorMessage` |
|---|---|---|---|---|---|---|---|---|---|
| **A** | **未设置** | `01a0eda2-d3f8-7982-9ab8-211439134d90` | succeeded | 30 | **0**（0/30） | `none` | 0 | 0 | — |
| **B** | 指向本 KB 的账本 | `01a0eda3-36b0-744e-80ce-44949511e223` | succeeded | **60** | **1**（**30/30**） | **`ledger`** | **10** | 0 | — |
| **C** | 指向 kbId 被改坏的账本 | `01a0eda3-9510-7688-a094-2246bdc1ad37` | **failed** | 0 | `null` | — | — | 0 | `corpus ledger kbId 00000000-0000-7000-8000-0000000000ff != run KB 01a0eda2-6781-7ca3-90e8-17dcd7ba68c2` |

（A 跑发生在补灌 DB 题之前，故 `caseCount=30`；补灌后题库为 60，B 跑起 `caseCount=60`。）

**三条结论**：

1. **未设置 → 与今天逐位一致**（A：`none` / 0 / `[]`；`hitAtK` 仍是结构性 0）。
2. **设置且自洽 → 数字变成真比值**（B：`ledger` / 10 / `[]`；`hitAtK` 0 → 1）。`docMapResolved=10` 与上一图 api CLI 侧**完全相同**（同夹具、同账本、同 10 个去重逻辑 id）。
3. **设置但不可用 → 响亮失败**（C：job 落 `failed`，错误信息点名「账本 kbId ≠ 本次 KB」）。**没有降级成「未设置」** —— 若降级，B 与 C 会给出同样的 `none/0/[]`，那道新鲜的闸就等于常开。

## 5. 落库原始形状（不经 DTO）

直接查 `eval_runs`（`report_json` 是 jsonb）：

```
                  id                  |  status   | retrieve_mode | signoff_eligible |  src   | res | hit | scored | hits |          err
--------------------------------------+-----------+---------------+------------------+--------+-----+-----+--------+------+--------------------------------
 01a0eda3-9510-7688-a094-2246bdc1ad37 | failed    | live          | 0                |        |     |     |        |      | corpus ledger kbId 00000000-... != run KB 01a0
 01a0eda3-36b0-744e-80ce-44949511e223 | succeeded | live          | 1                | ledger | 10  | 1   | 30     | 30   |
 01a0eda2-d3f8-7982-9ab8-211439134d90 | succeeded | live          | 0                | none   | 0   | 0   | 30     | 0    |
```

- 库内形状与 DTO 透出**一致**（B：`ledger/10/1/30/30`；A：`none/0/0/30/0`）—— 落库白名单已按报告真值写，不再硬编码常量。
- 失败行（C）**不写 `report_json`**（`markFailed` 只写 `status` + `error_message`）—— 故 `src`/`hit` 为空是正确表现，不是丢字段。
- **`signoff_eligible=1`（B 跑）是 L1 的工程口径**（`retrieveMode=live` ∧ 两类各 ≥30，本跑 60 题 = 30 answerable + 30 unanswerable），**不是业务 PASS**：`coverage=0`（mock chat 全 `abstained`）、无 judge AUROC、无人工抽检、无四要素。与 `apps/api/README.md` 的既有措辞一致。

## 6. 与 api CLI 侧的对照

| 维度 | api CLI（上一图已实测） | worker 队列路径（本轮） |
|---|---|---|
| 题源 | `fixtures/l1/gold.yaml`（文件） | `gold_questions` 表（DB） |
| 账本参数 | env `L1_DOC_MAP` | env `L1_DOC_MAP`（**同名同义**） |
| 账本不可用 | `exit 2` 拒跑 | job `failed` + 点名 `errorMessage` |
| 不带账本 | `hitAtK=0/30`、`none/0/[]` | 同 |
| 带账本 | `hitAtK=30/30`、`ledger`、`resolved=10` | 同 |
| 落库 | `buildEvalRunInsert` 整对象直落 | 逐键白名单（本轮改为取报告真值） |

两条入口对同一份账本给出**同一含义**的 `hitAtK` —— 这是本图的目的地。

## 7. 留痕（`artifacts/` 已 gitignore，为便于本机复核列出）

| 路径 | 内容 |
|---|---|
| `artifacts/eval-corpus-ledger-01a0eda2-6781-7ca3-90e8-17dcd7ba68c2.json` | 本轮账本（13 条） |
| `artifacts/l5-bad-ledger.json` | 场景 C 用的坏账本（kbId 改成 `00000000-0000-7000-8000-0000000000ff`，entries 未动）—— **留痕不删** |
| 三条 run 的落库行 | 见 §5 的 runId，可直接 `select` 复核 |

## 8. 未核实 / 不在本页

- **真模型**：无 `GATEWAY_BASE_URL`，chat 仍 mock → 60 题全 `abstained`、`coverage=0`。本页的 `hitAtK` 只说明「映射面通了」，**不说明检索质量**。
- **ES 分词**：vanilla 8.15.3 无 IK，中文检索靠标准分词；命中数能被账本解释，不代表生产分词效果。
- **两条入口的题源差异**（文件 vs DB）本图**未对齐**，只对齐了数字含义 —— 已记入地图 `Not yet specified`。
- **账本 ↔ 库内文档的运行时不变量**：源码仍不做校验（前图裁定 4 显式划出），本图未改。
