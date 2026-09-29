# 真中间件栈真跑记录（2026-09-29）

本文件是**一次真跑的原始证据**：在 Windows + Docker Desktop 上，把 `docker/docker-compose.yml` 的五服务真起，对**真 PostgreSQL / Redis / Elasticsearch / MongoDB / RustFS** 跑迁移与端到端入库。

**它不是生产线**：`operable-stack.md` 的「非生产级」口径一条未变；这里的 ES 是 vanilla 8.15.3（**无 IK**），扫描仍 `mock_clean`，向量仍 `mock`，`AUTH_ENFORCE` 仍 false。**此页任何数字都不得进签字包。**

- 执行图：[`.scratch/real-stack-evidence/map.md`](../../.scratch/real-stack-evidence/map.md)（工单 02–06）
- 逐项取证：`.scratch/real-stack-evidence/research/02-stack-up.md` · `03-migrate-real-pg.md` · `04-half-smoke.md` · `05-real-es.md`

## 1. 结论速览

| 项 | 结果 |
|----|------|
| 五服务真起 | ✅ 全 `running|healthy` |
| 逐服务探活 | ✅ `pg_isready` / `PONG` / ES `status:green` / Mongo `ping=1` / RustFS `{"status":"ok","ready":true}` |
| `GET /ready` | ✅ `postgres`·`redis`·`elasticsearch`·`mongo` = up；`s3` 首启前 down（桶由首次 put 建）；`gateway` skipped |
| 迁移在真 PG 上 apply | ✅ 空库从零 apply 零错误；**23 SQL = 23 journal = 23 已应用**；`db:generate` 零漂移 |
| 端到端入库（真 RustFS + 真 Mongo + **真 ES**） | ✅ 上传 → complete → 四眼审批 → scan → parse → chunk → embed → ES bulk → 双就绪 `ready` |
| 评测语料入库 + L1 Hit@20（**续图 `eval-corpus-map`**） | ✅ 13 篇语料入库并激活、账本 13 条；**同一夹具**不带账本 `hitAtK=0/30`、带账本 `30/30`（mock 向量 + 无 Gateway，**非签字数字**，见 §7） |
| ask 有引用 | ❌ **阻塞方 = 无可用 Gateway**（需 chat + embed + rerank 三契约，见 §4） |

## 2. 本轮真跑改掉的两处源码缺陷

两处都**只在真集群上现形**，且都是收紧：

### 2.1 `bulkIndexSparse` 未等刷新 → 真集群上必现误红

- 现象：`stage=es_index` 首次执行失败 `ES_RECONCILE_FAILED`，文档被写成 `status=failed` / `errorCode=ES_RECONCILE_FAILED`，靠 BullMQ 重试 2 秒后才转 `ready`。
- 根因：ES 近实时，`POST /_bulk` 之后立刻 `_search` 读不到刚写入的文档 → `reconcileIndexed` 判 `missing`。mock ES 是进程内 set 比对，**永远不会暴露**。
- 修复：`POST /_bulk?refresh=wait_for`（`apps/worker/src/ingest/es-http.ts`）；新增测例 `apps/worker/tests/ingest/es-bulk-refresh-before-reconcile.test.ts` 钉住该参数与「写后读一次判 ok」。
- 真跑复核：修复后入库段 `uploaded → indexing_es → ready` **一次成功**，无 `failed` 过渡、无重试。

### 2.2 `smoke:half` 与 ADR-048 四眼闸不一致

- 现象：`POST /documents/:id/approve` 回 403 `self_approve_forbidden`。
- 根因：脚本用同一 dev-login 主体上传并审批；`apps/api/src/routes/documents/index.ts` 按 ADR-048 #4 调 `evaluateSelfDecide` 挡自审。四眼闸是后加的，脚本没跟着改。
- 修复：脚本先**断言自审必须 403**，再换 `half-smoke-reviewer@local.dev`（`kb_admin`）审批与 scan。

## 3. 真 ES 上的检索行为（本机实测）

- **中文检索可用**：`match` 查「检索闸」在 `strict_rag_dev` 上命中 2 条（`max_score` 非零），索引与查询两侧都由默认 `standard` 分词。
  → **IK 不是该路径「能用」的必要条件**；它影响分词粒度与排序质量。「B8 真 ES+IK」里的 IK 仍属排序质量 / 生产话术，本页不为它下结论。
- **mapping 落地**：uuid 类字段全 `keyword`、`sparseText` `text`、`visibilityLevel` `integer`，与 worker 的 `SPARSE_INDEX_PROPERTIES` 逐字段一致。
- **`aclPrincipals` 三态真集群复核**（此前只在 mock 断言过）：
  - `null` → 字段不写；`[]` → 写哨兵 `["__acl_none__"]`（ES `exists` 不认空数组）；`[uid]` → 写 uid 列表；
  - 查询期 `should = [must_not exists(aclPrincipals), term(aclPrincipals: uid)]`：非名单用户只见「无名单」文档；名单内用户可见「无名单」+「本人名单」文档。**逐位符合预期。**
- **没装 IK 的代价**：`es-sparse.ts` 查询期无 `doc_type` 过滤（索引也无该字段），故 ES 在**超集**上排序，范围内的文档可能被挤出 top-k。**这不构成泄漏**——`retrieve.ts` 在 sparse 命中后立刻与 PG 语料求交，场外 chunk 一律丢弃；损失是召回而非安全。

## 4. ask 段的真边界：一份同时提供三条契约的 Gateway

`GATEWAY_MODE=http` 时，api 的客户端要求上游**同时**提供：

| 用途 | 路径 | 响应要点 |
|------|------|----------|
| chat（generate / claim_split / judge / route / rewrite） | `POST {base}/chat/completions` | `choices[0].message.content` 须是**严格 JSON 单行** |
| embed | `POST {base}/embeddings` | `data[{embedding,index}]` |
| **rerank** | `POST {base}/rerank` | `results[{index, relevance_score}]` |

三条缺一不可：`runRetrieve` **无条件**调 rerank，失败即拒答。而缺 `GATEWAY_BASE_URL` 时走 mock，mock chat 返回纯文本 `[mock:generate] …`（不是 JSON）→ `internal_guard` → `abstained` → 烟测在 ask 一步因空引用失败。**这是既定口径，不是环境故障**（`half-smoke.md` 已写）。

本机补充实测：本机 Ollama 有 embedding 与 rerank 模型、**没有对话模型**，且 Ollama 不暴露 `/rerank` 端点 → 「把 Gateway 指向本机 Ollama」在本机也不成立。

**因此**：`docs/module-status/worker.md` 里「入库闭环可演示」与 api 侧「问答可演示」两条，在真栈上**取到的是不同水位**——入库段已在本机真栈跑通；问答段需要一台真 Gateway，本机没有。

## 5. 复现命令

```bash
docker compose -f docker/docker-compose.yml up -d      # 五服务
pnpm db:migrate                                        # 真 PG 上 apply（全新库先配 SUPER_ADMIN_*）
pnpm up:apps                                           # 或分别启 api / worker，叠加 .env.operable.example
pnpm smoke:half                                        # 端到端；ask 一步需真 Gateway
```

## 6. 本机执行的两条注意事项（非仓库缺陷）

- Docker Desktop 在本机运行期间**自行退出两次**，每次需重新拉起并 `compose up -d`（卷保留，数据不丢）。
- 真跑期间曾尝试拉取一个本地对话模型用于 ask 段，**在本机网络上未推进**（数分钟零字节增长），已终止；不影响 §1–§3 的任何结论。

## 7. 续图（2026-09-29 · `eval-corpus-map`）：评测语料入库 + 映射账本 → L1 Hit@20 可真测

逐项取证：[`.scratch/eval-corpus-map/research/05-real-stack-hit20.md`](../../.scratch/eval-corpus-map/research/05-real-stack-hit20.md)。

**背景**：PRD §3 / §6 把 **Hit@20 ≥ 70%（有标注时）** 写成硬门，代码侧也把它接进了 ADR-046 判定（`evaluateAdr046Bind` 的 `hitAtKOk` 进 `businessPass`）。但夹具写的是**逻辑 id**（`ingest-samples/01-doc` 等），真跑 `evidence.docId` 是 `documents.id`（uuid），而全仓既无映射面、`fixtures/l2/corpus/*` 也从未入库 → `hitAtK` 是**结构性恒 0**（`0 >= 0.7` 假 → `hit_at_k_below_min`），**与是否用真模型无关**。本续图把这层数据面补上。

**新增能力**（本页不重复接口细节，见 `operable-stack.md` §3）：入库入口 `apps/api/src/scripts/ingest-eval-corpus.ts` 把两份语料 13 篇送入一个 KB 并写出账本 `artifacts/eval-corpus-ledger-<kbId>.json`（含 `kbId` / 语料指纹 / 每条的 `logicalId`、`docId`、`title`、源文件 sha256）；跑批侧 `L1_DOC_MAP` / `L2_DOC_MAP` 指定账本后在比对前解析，账本与本次 KB 或当前夹具不符即 **exit 2 拒跑**，未传账本时与今天逐位一致。

**真栈实测（同一夹具、同一 KB、唯一变量 = 账本）**：

| 字段 | 不带账本 | 带账本 |
|---|---|---|
| `hitAtK` | **0**（0/30） | **1**（30/30） |
| `docMapSource` / `docMapResolved` / `docMapUnmappedIds` | `none` / 0 / `[]` | `ledger` / 10 / `[]` |
| `verdict.reasons` 是否含 `hit_at_k_below_min` | **含** | **不含** |
| `businessPass` | false | false（其余阻塞方一条未动：`coverage_zero_or_null` · `judge_auroc_*` · `human_spot_missing` · 四要素 · `internal_guard`） |

**这不是签字数字**：向量仍 mock（8 维）、chat 仍 mock（无 `GATEWAY_BASE_URL`）、60 题全部 `abstained`、ES 是 vanilla 无 IK；`retrieve_mode=live` 只反映 ES 检索档位。本页任何数字都不得进签字包。

**本机注意（沿用 §6）**：本轮 Docker Desktop **再次自行退出**（第 3 次），其中一次落在两次 L1 之间的窗口里 → 那一跑 60 条 case 全部 `error`，原文是 `Failed query: select … from "documents" …`（PG 不可达），`errorCount=60` / `coverage=null`。**机制是诚实的**（不假绿、不静默跳过）；重启守护进程 + `compose up -d` 后原样重跑得 `errorCount=0`，本页数字以健康栈上的重跑为准。

**本机留痕**（`artifacts/` 已 gitignore，为便于在本机复核，目录名列出）：入库账本 `artifacts/eval-corpus-ledger-<kbId>.json`（13 条）；故障那一跑 `artifacts/l1-with-map/`（`errorCount=60`，**留痕不删**）；健康栈上的成对重跑 `artifacts/l1-no-map-2/`（0/30）与 `artifacts/l1-with-map-2/`（30/30）——两份 `l1-gate-snapshot.json` 的 `verdict.reasons` 差集就是 §7 那张表。

## 8. 续图（2026-09-29 · `eval-ledger-parity`）：worker 队列路径接账本 + 三态实测

逐项取证：[`.scratch/eval-ledger-parity/research/05-real-stack-worker-run.md`](../../.scratch/eval-ledger-parity/research/05-real-stack-worker-run.md)。

**背景**：§7 只把 api CLI 一条入口接上账本，worker 队列路径（`POST /knowledge-bases/:kbId/eval/runs` → BullMQ `sr-eval` → `runL1Batch`）仍在 `hitAtKCase` 处直比「夹具逻辑 id vs `documents.id` uuid」→ `hitAtK` **结构性恒 0**；更关键的是**这条链此前从未被端到端跑过**（api 侧测试注入假 `enqueue`，worker 侧测试注入内存 persist）。本续图给 worker 侧加上与 CLI **同名同义**的进程级 env `L1_DOC_MAP` / `L2_DOC_MAP`，并**第一次**把「运营台发起 → 队列 → worker → 落库」在真栈上闭环。

**链条首次贯通**：真 compose（PG + Redis + ES 8.15.3 + Mongo + RustFS）上，`POST /knowledge-bases/<kbId>/eval/runs`（`runType=golden_2x2`）→ `sr-eval` → worker 消费 → `eval_runs` 落库，全程真跑；同一 KB（`01a0eda2-6781-7ca3-90e8-17dcd7ba68c2`）、同一账本、同一夹具，**唯一变量 = worker 的 `L1_DOC_MAP`**（worker 每次以不同 env 重启 —— env 是模块加载期快照）。

**三态对照**：

| 场景 | worker 的 `L1_DOC_MAP` | run `status` | `hitAtK`（hits/scored） | `docMapSource` | `docMapResolved` | `errorMessage` |
|---|---|---|---|---|---|---|
| A | **未设置** | succeeded | **0**（0/30） | `none` | 0 | — |
| B | 指向本 KB 账本 | succeeded | **1**（**30/30**） | **`ledger`** | **10** | — |
| C | 指向 kbId 被改坏的账本 | **failed** | `null` | — | — | 点名「账本 kbId ≠ 本次 KB」 |

三条结论：① **未设置 → 与改动前逐位一致**（A：`none` / 0 / `[]`，`hitAtK` 仍结构性 0）；② **设置且自洽 → 数字变成真比值**（B：`ledger` / 10 / `[]`，`hitAtK` 0 → 1，`docMapResolved=10` 与 §7 的 api CLI 侧**完全相同**）；③ **设置但不可用 → 响亮失败**（C：job 落 `failed`），**没有降级成「未设置」** —— 若降级，B 与 C 会给出同样的 `none/0/[]`，那道新鲜的闸就等于常开。

**库内原始形状**（直接查 `eval_runs`，不经 DTO）：`report_json` 是 jsonb，`report_json.hitAtK` 与顶层列 `hit_at_k` 一致（B：`ledger/10/1/30/30`；A：`none/0/0/30/0`）—— 落库白名单已按报告真值写，不再硬编码常量；失败行（C）**不写 `report_json`**（`markFailed` 只写 `status` + `error_message`），故其 `src`/`hit` 为空是正确表现，不是丢字段。`signoff_eligible=1`（B 跑）是 **L1 的工程口径**（`retrieveMode=live` ∧ 两类各 ≥30），**不是业务 PASS**：`coverage=0`（mock chat 全 `abstained`）、无 judge AUROC、无人工抽检、无四要素。

**这不是签字数字**：向量仍 mock（8 维）、chat 仍 mock（无 `GATEWAY_BASE_URL`）、ES 是 vanilla 8.15.3 无 IK、可答类全 `abstained`（`coverage=0`）。`retrieve_mode=live` 只反映 ES 检索档位。本页任何数字都不得进签字包。

**本机留痕**（`artifacts/` 已 gitignore，列出便于本机复核）：本轮账本 `artifacts/eval-corpus-ledger-01a0eda2-6781-7ca3-90e8-17dcd7ba68c2.json`（13 条）；场景 C 用的坏账本 `artifacts/l5-bad-ledger.json`（kbId 改成 `00000000-0000-7000-8000-0000000000ff`，entries 未动）—— **留痕不删**；三条 run 的落库行可直接 `select` 复核。

**环境坑三条**（本轮踩到，已写入 [operable-stack.md §6](./operable-stack.md)）：turbo `dev` 任务 env 白名单过滤 operable 变量 · `pnpm --filter` 的 `@` 经 PowerShell `.cmd` 被拼坏 · Docker 自退后 ES host 端口转发丢失须 `restart` 容器。

**未核实 / 不在本页**：两条入口的**题源不同**（CLI 读 `fixtures/l1/gold.yaml`、worker 读 DB 表 `gold_questions`）—— 本图只对齐数字**含义**，未对齐题源；账本 ↔ 库内文档的**运行时不变量**仍不做校验（前图裁定 4 显式划出）；L2 真跑与准出仍缺。
