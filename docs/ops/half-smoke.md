# HALF-SMOKE 清单（txt → ask 有引用）

口径：可重复跑通 **txt 上传 → complete → 审批 → scan → 双就绪 → active → ask 有引用**。  
检索闸仍 **ready ∧ active**（不自动升 active）。扫描 / 向量 / ES 可为 mock。**不是** 生产 ES、**不是** 真杀毒。

## 前置

1. `docker compose -f docker/docker-compose.yml up -d` 或 `pnpm up:apps`（见 [operable-stack.md](./operable-stack.md)）
2. `pnpm db:migrate`（**全新库**还须先按 [operable-stack.md](./operable-stack.md) §2 配 `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`，否则 api 起不来）
3. api :4000 与 worker 已起（`pnpm up:apps`）

扫描 / 向量 / ES 可为 mock（CI 默认 mock 即可入库）。  
live ask 须 Gateway 产出合法 generate / claim_split / judge JSON；缺 `GATEWAY_BASE_URL` 时默认 mock chat **不是** JSON，ask 会拒答、本脚本因空引用失败。  
引用判定单测不连 api：`node --test scripts/smoke-ask.test.mjs`。

## 三条契约最小形状（末步 ask 用）

http 客户端**不下发** `purpose`，Gateway 只能按 `messages[0].content`（三份 system prompt 互不相同）区分；chat 端点 `POST {base}/chat/completions`。

| purpose | content = `<JSON 字符串>` | 硬约束 |
|---|---|---|
| generate | `{"answer":"string","citations":["chunkId",…],"insufficient":false}` | `citations` 必须 ∈ 本轮 EVIDENCE 的 `chunkId`；证据不足 → `{"answer":"","citations":[],"insufficient":true}`（系统据此拒答） |
| claim_split | `{"claims":[{"text":"…","chunkIds":["chunkId"]}]}` | `chunkIds` ⊂ 上一步 citations；每条至少 1 个 |
| judge | `{"scores":[0.0,…]}` | 长度 === claims 数，每条 0~1 且 **≥ `TAU_CLAIM`**（默认 0.5，min 否决） |

另有检索内 embed `POST {base}/embeddings`（worker 侧为 `{base}/v1/embeddings`）与 rerank `POST {base}/rerank`。

## 可核命令

```bash
curl -s http://127.0.0.1:4000/ready | jq '.checks.gateway'
```

配了 `GATEWAY_BASE_URL` → `"up"`；未配 → `"skipped"`（软依赖，`ready` 仍为 `true`）。

## 用桩（dev-only，可选）

[`scripts/stub-gateway.mjs`](../../scripts/stub-gateway.mjs) 是独立进程的**抽取式**桩：只从提示里的 EVIDENCE 抽取，`citations` 逐字取自 evidence 行，证据不足即 `insufficient:true`。

```bash
# 终端 1：起桩（默认 :4100，dims=8；env STUB_GATEWAY_PORT / STUB_GATEWAY_EMBED_DIMS 可覆盖）
node scripts/stub-gateway.mjs

# 终端 2：api+worker 必须以同一 env 起（否则 api 仍走默认 mock），再跑烟测
GATEWAY_BASE_URL=http://127.0.0.1:4100 pnpm up:apps
GATEWAY_BASE_URL=http://127.0.0.1:4100 pnpm smoke:half
```

**桩口径**：只证明**管道接对**，**不是**质量证据，**不得**进签字包；生产档位（`APP_ENV`/`NODE_ENV=production`）**拒绝启动**；只从 EVIDENCE 抽取、不编造 `chunkId`。桩跑出的 `PASS` **不等于** RAG 可用 / 可签字。

## 末步失败的三种可分辨形态

1. **未配 Gateway**（`checks.gateway=skipped` 且 `reason=internal_guard`）：脚本打印「末步需要 chat 的三条 JSON…本机未配 Gateway…见 docs/ops/half-smoke.md；也可用 dev-only 桩…」。
2. **用的是桩**（`GATEWAY_BASE_URL` 指向的 `GET {base}/__stub` 命中 `{stub:true}`）：脚本打印 `gateway=stub` 标注（成功行为 `PASS … (gateway=stub · 仅证明管道接对 · 非质量证据)`，失败时同样先标注）。
3. **管道其它原因**：`reason` ∈ `low_retrieval` / `rerank_unavailable` / `claim_split_failed` / `unsupported_claims` / `invalid_citations` → 逐条翻译成「哪一环坏了 + 看本页三条契约」。

## 命令

```bash
pnpm smoke:half
```

期望 stdout 含 `PASS` 且 `citations=` ≥ 1。空引用 → 非零退出。

## 步骤（脚本已串）

| 步 | HTTP | 说明 |
|----|------|------|
| 1 | `GET /health` · `GET /ready` | PG+Redis 硬依赖 |
| 2 | `POST /api/v1/auth/admin/dev-login` | ask 始终验成员；超管可 ask |
| 3 | `POST /api/v1/knowledge-bases` | 建库 |
| 4 | `POST .../upload-url` → `PUT` 对象 → `POST .../complete` | 单篇 `fixtures/ingest-samples/01-doc.txt` |
| 5 | `POST .../approve`（**自审必 403**）→ 换 `half-smoke-reviewer@local.dev`（`kb_admin`）再 `approve` → `POST .../scan` | 审批闸后入队；ADR-048 #4 四眼：提交人不得批自己的单 |
| 6 | 轮询 `GET /api/v1/documents/:id` | `status=ready` 且双就绪 |
| 7 | `PATCH .../lifecycle` `{ lifecycle: "active" }` | **显式上架** |
| 8 | `POST .../ask` | `data.citations` 非空 |

## 明确不是

- 自动升 active  
- 生产 ES+IK / 真杀毒 / 默认 `AUTH_ENFORCE=true`
