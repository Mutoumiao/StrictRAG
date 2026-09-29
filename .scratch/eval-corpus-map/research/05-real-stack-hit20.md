# 工单 05 · 真栈真跑：语料入库 → 带账本跑 L1 → 实测 Hit@20

**性质**：一次真跑的原始取证。跑在 Windows + Docker Desktop 上，中间件是 `docker/docker-compose.yml` 的真 PostgreSQL / Redis / Elasticsearch / MongoDB / RustFS。

**这不是签字数字**：`AUTH_ENFORCE=false`、`INGEST_SCAN_MODE=mock_clean`、`INGEST_EMBED_MODE=mock`（8 维向量）、**无 Gateway**（chat/embed 走 mock）。本页任何数字都不得进签字包。

---

## 0. 结论速览

| 项 | 结果 |
|----|------|
| 五服务真起 | ✅ 全 `healthy`（ES 8.15.3 vanilla、PG 16 + pgvector、Redis 7、Mongo 7、RustFS） |
| `pnpm db:migrate` | ✅ `migrations applied successfully`（幂等，`__drizzle_migrations` 已存在） |
| `GET /ready` | ✅ `{"ready":true,"checks":{"postgres":"up","redis":"up","elasticsearch":"up","gateway":"skipped","s3":"up","mongo":"up"}}` |
| 评测语料入库 | ✅ **13 篇**（`ingest-samples/01..10-doc` + `l2-corpus/{leave-policy,meal-allowance,travel-stay}`）全部 `ready` 且 `lifecycle=active` |
| 映射账本 | ✅ 13 条，`docMapResolved=10`、`docMapUnmappedIds=[]`（L1 夹具真正引用到的 10 个逻辑 id 全部命中） |
| **Hit@20（不带账本）** | **0/30 = 0**，硬门裁决含 `hit_at_k_below_min` |
| **Hit@20（带账本）** | **30/30 = 1**，硬门裁决**不含** `hit_at_k_below_min` |
| `businessPass` | ❌ 两跑都 false —— 换成了别的（既有的、与映射无关的）阻塞方，见 §4 |

---

## 1. 环境与命令

环境注入走**进程级**（不修改仓库 `.env`）：把 `.env.operable.example` 的键值 + `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` 注入子进程环境后执行命令（`dotenv` 默认不覆盖已存在的进程环境变量，故注入优先生效）。

```bash
docker compose -f docker/docker-compose.yml up -d      # 五服务
pnpm db:migrate                                        # 真 PG 上 apply
pnpm --filter @strict-rag/api start                    # api（真栈 env）
pnpm --filter @strict-rag/worker start                 # worker（真栈 env）

# ① 语料入库 + 出账本（新入口，本图工单 03 落地）
INGEST_KB_NAME=eval-corpus-kb-20260929 \
  pnpm --filter @strict-rag/api exec tsx src/scripts/ingest-eval-corpus.ts

# ② 不带账本（回归锚）
L1_KB_ID=<kb-uuid> L1_OUT_DIR=<repo>/artifacts/l1-no-map-2 \
  pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts

# ③ 带账本
L1_KB_ID=<kb-uuid> L1_DOC_MAP=<repo>/artifacts/eval-corpus-ledger-<kb-uuid>.json \
  L1_OUT_DIR=<repo>/artifacts/l1-with-map-2 \
  pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts
```

## 2. 入库真跑输出（原样摘要）

```
kbId=01a0ed38-a804-771f-ac58-a7f07e495d08
fixtures: 13 files
enqueued ingest-samples/01-doc → 01a0ed38-a81a-73ff-b112-4913c1f03ddb
…（10 篇 ingest-samples）
enqueued l2-corpus/leave-policy → 01a0ed38-ab21-71c7-8652-de86b9f66881
enqueued l2-corpus/meal-allowance → 01a0ed38-ab55-7dee-a21e-cb6be1eeb011
enqueued l2-corpus/travel-stay → 01a0ed38-ab8c-7d25-846b-71b582f25a59
ledger=<repo>\artifacts\eval-corpus-ledger-01a0ed38-a804-771f-ac58-a7f07e495d08.json
entries=13 fingerprint=c437c632c4785b2f79e704a76eb46ff1bc39d2e1696322d97919280b92f8c1dd
```

- 退出码 0；每篇都经 `upload-url → PUT → complete → approve → scan → ready → active`。
- **四眼闸真跑生效**：入库 CLI 在首篇先打自审探针（上传者自审 `approve` 必须 403），非 403 即失败；真跑通过 → 说明审批确实换了第二个身份（`ingest-eval-reviewer@local.dev`）。
- 账本是 `artifacts/` 下的运行产物（该目录 gitignore），**不含**任何签字语义。

## 3. 两跑对照（同夹具、同 KB、同档位，唯一变量 = `L1_DOC_MAP`）

| 字段 | A 不带账本 | B 带账本 |
|---|---|---|
| `mode` / `retrieve_mode` | `live` / `live` | `live` / `live` |
| `caseCount` | 60 | 60 |
| `errorCount` | 0 | 0 |
| `matrix` | `{A:0,B:30,C:0,D:30}` | `{A:0,B:30,C:0,D:30}` |
| `coverage` | 0 | 0 |
| `hitAtK` | **0** | **1** |
| `hitAtKHits` / `hitAtKScored` | 0 / 30 | **30 / 30** |
| `docMapSource` | `none` | `ledger` |
| `docMapResolved` | 0 | **10** |
| `docMapUnmappedIds` | `[]` | `[]` |
| `citationComplete` / den | `null` / 0 | `null` / 0 |
| `signoffEligible` | `true` | `true` |
| `outcome` 分布 | `abstained × 60` | `abstained × 60` |

Hit 的 30 条恰是全部 `answerable` 题（`l1-ans-001…030`）；另 30 条无 `expectedDocIds` → `hitAtKCase` 返回 `null` → 不进分母（故 `scored=30`）。

## 4. 硬门裁决的差异（本票最要紧的一格）

| 跑次 | `verdict.reasons` |
|---|---|
| A 不带账本 | `missing_proposal` · `missing_signatures` · `coverage_zero_or_null` · **`hit_at_k_below_min`** · `judge_auroc_missing_or_below_min` · `human_spot_missing` · `internal_guard` |
| B 带账本 | `missing_proposal` · `missing_signatures` · `coverage_zero_or_null` · `judge_auroc_missing_or_below_min` · `human_spot_missing` · `internal_guard` |

**`hit_at_k_below_min` 在 B 消失** —— Hit@20 这道 PRD 冻结的硬门第一次算出了真数字并通过（30/30 ≥ 70%）。

**同时必须说清它没解决什么**：`businessPass` 两跑都 false，其余六条阻塞方**一条未动**，且它们都**与映射无关**：

- `coverage_zero_or_null`：60 题全部 `abstained`（`internal_guard`）—— 本机无 Gateway，mock chat 返回的不是合法 JSON → 生不成答案 → 覆盖率 0。这是**真 Gateway 缺失**，不是映射问题。
- `judge_auroc_missing_or_below_min`：无 live 打分器、校准集仅 8 条（PRD §4 要 ≥100）。
- `human_spot_missing`：人工抽检账本须人写。
- `missing_proposal` / `missing_signatures` / `internal_guard`：ADR-046 四要素与业务人签。
- `signoffEligible=true` 是**既有语义**（`live ∧ 可答≥30 ∧ 不可答类≥30`），源码注释与 `docs/module-status/api.md` 都写着「live ≠ 自动签字」；本票不据此声称任何达标。

## 5. 真跑暴露的环境事实（非仓库缺陷，但必须记）

- **Docker Desktop 在本机再次自行退出**（本轮第 3 次；`real-stack-evidence.md` §6 已记两次）。其中一次退在 A 与 B 之间的窗口里 → 那一跑的 60 条 case 全部 `error`，`errorMessage` 原样是 `Failed query: select … from "documents" where …`（PG 不可达）。
  - **机制表现是诚实的**：不是假绿、不是静默跳过，而是 `errorCount=60` 且 `coverage=null`。
  - 重启守护进程 + `compose up -d` 后**原样重跑**，`errorCount=0`，得到 §3 的干净对照。故本页结论以**健康栈上的重跑**为准，并把那次故障留痕（不删、不写成「无异常」）。
- 从故障那一跑还顺带确认了一条口径：**账本新鲜度校验在跑批开始前就发生**，故它与「跑批途中 DB 掉线」是两类失败，前者 `exit 2` 拒跑、后者逐题记 `error`。

## 6. 未做 / 边界

- **未跑 L2**（`L2_DOC_MAP` 同构接线已落并有测例，但本机没跑真 L2 批跑）。
- **未做真人抽检、未做 live judge、未接真 Gateway** —— §4 已逐条点名。
- **worker 侧 `run-l1-batch.ts` / `run-l2-batch.ts` 未接账本**（工单 02 裁定 2 显式划出）：worker 批跑的 Hit@k / docHit 仍恒 0，且两者都不进任何判定。
- **本页数字不得进签字包**（mock 向量 + mock chat + 无 IK 的 vanilla ES）。
