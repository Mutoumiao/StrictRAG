# 02 · 裁定：建 dev-only 桩（路 A）还是如实记为环境前置 + 让失败可诊断（路 B）

Type: grilling
Status: resolved
Parent: ../map.md
Blocked by: 01

## Question

基于工单 01 的现状面择一并给出可执行细则。

## Answer

依据 [`research/01-ask-gateway-surface.md`](../research/01-ask-gateway-surface.md)。

### R1 · 选路：**路 A（建 dev-only 桩）为主，并把路 B 的可诊断性作为并列要求**

**理由（逐条落在证据上）**：

1. 失败面**比想象窄得多**：`debug.evidenceCount=2` / `retrieveCalls=1` 证明**检索侧全通**（embed + 真 ES sparse + rerank 在 mock 档不发上游请求）；末步唯一障碍是 `generate` 那一次 chat 要 JSON 而 mock 给的是 `[mock:generate] …`。只为一个解析器缺 JSON 就让整条 DoD 不可复现，代价与收益不成比例。
2. **「mock chat 非 JSON」没有冻结契约背书**：研究查遍 `prds/07-models`，**找不到**一条 PRD / ADR 明文规定 mock 的输出形状；现有依据是「实现 + 注释 + 文档叙述」。既然它不是冻结语义，**新增一条显式开启的 dev 通路不构成改冻结语义**。
3. **桩不会削弱「宁拒勿妄」**：桩**不是** api 代码里的 mock，而是**另一台进程**，由 `GATEWAY_BASE_URL` 指过去（研究已证：dev 的 rerank 节点下限为 1，**零生产代码改动**可行）。api 侧一字节不动 ⇒ 「只有拿到可 verify 的 JSON 才作答」这条姿态**原样保留**；被否掉的形态是「在 `apps/api` 里加一个会编答案的 mock 档」。
4. **桩必须是抽取式而不是罐头答案**（本裁定的核心约束）：桩只能**从提示里给定的 EVIDENCE 抽取**、`citations` 必须**逐字取自** evidence 行的 `chunkId=`；**证据回答不了问题时必须回 `insufficient: true`**（→ 系统 abstain）。这样桩是**确定性的抽取式基线**，它让「有证据才作答」更硬，而不是更软。

### R2 · 桩的姿态（硬性）

| 项 | 规定 |
|---|---|
| 形态 | **独立进程**（`scripts/` 下的一个 HTTP 服务），**零 `apps/` 代码改动**；不新增 `GATEWAY_MODE` 档位（避免碰 18 个测试文件 / 104 个 `it()`） |
| 端点 | `POST /chat/completions` · `POST /embeddings` · `POST /rerank` · `GET /v1/models`（供 `/ready` 软探活）· **`POST /v1/embeddings`**（worker 侧 embed(http) 多一层 `/v1`，研究实测发现的前缀不一致）· **`GET /__stub`**（自证身份，见下） |
| chat 分支 | http 客户端**不下发 `purpose`** ⇒ 按 `messages[0].content`（三份 system prompt 互不相同）分支为 generate / claim_split / judge 三种响应 |
| 自证身份 | `GET /__stub` 返回 `{"stub":true,"version":…}`；`smoke:half` 用它**确定性地**判断这一跑用的是桩（真网关会 404，不误判） |
| 启动护栏 | `APP_ENV=production`（或 `NODE_ENV=production`）→ **拒绝启动**；启动时打印**响亮 banner**（dev-only · 只证明管道 · 不是质量证据 · 不得进签字包） |
| 确定性 | 同一输入同输出（抽取 / 打分 / 向量均为确定性纯函数），不得用随机数或时间戳 |
| 端口 | 默认 `4100`，可用 env 覆盖 |

### R3 · 可诊断性（并列要求，与走哪一路无关）

`scripts/smoke-half.mjs` 末步失败时必须给出**可分辨**的诊断，至少覆盖三条：
- **缺 Gateway**（`/ready` 的 `checks.gateway === 'skipped'` 且末步 `reason === 'internal_guard'`）→ 明确打印「末步需要 chat 三条 JSON；本机未配 Gateway；见 docs/ops/half-smoke.md」；
- **用的是桩**（`GET {GATEWAY_BASE_URL}/__stub` 命中）→ 成功时打印 `PASS (gateway=stub · 仅证明管道接对)`，失败时同标；
- **管道问题**（`reason` 不是 `internal_guard`：`low_retrieval` / `rerank_unavailable` / `claim_split_failed` / `unsupported_claims` / `invalid_citations`）→ 把 `reason` 翻译成一句「哪一环坏了 + 该看哪份文档」。

### R4 · 文档落点（按第三人实际会读的顺序）

1. `docs/ops/half-smoke.md`（**清单页**）：补「三条契约最小形状 + 一行可核命令（`GET /ready` 看 `checks.gateway`）+ 用桩的完整两条命令 + 桩口径声明」；
2. `scripts/smoke-half.mjs` 的**运行时输出**（第三人最先撞到的地方）；
3. `docs/ops/operable-stack.md`：复述末步前置与桩入口；
4. `docs/module-status/README.md` 半产品段 + `api.md`：把「是否另建 dev-only 桩属产品决定，未做」改为终态（**写明桩存在、口径、以及它不改变任何默认**）；
5. `.scratch/fog-inventory-2026-09-23.md`：簇 39 收口注记。

**文档口径硬要求**：任何一处都**不许**把「桩跑出的 PASS」写成「RAG 可用 / 可签字」；必须写「只证明管道接对，**不是**质量证据」。

### R5 · 禁则（实现方不许做）

- **不许**在 `apps/` 生产代码里为桩开后门（不新增档位、不加 env、不加分支）。
- **不许**为了让 `smoke:half` 变绿而放宽 ask 的任何闸（verify / minSupport / 引用判定 / `parse.ts` 的严格性）。
- **不许**让桩产出**证据里没有**的内容或 `chunkId`（那是 `invalid_citations`）；证据不足必须 `insufficient: true`。
- **不许**改 `GATEWAY_MODE` / `GATEWAY_BASE_URL` / 任何 env 的**默认值**；不许改 `prds/00–11`；不许改门限数字与判定公式。
- **不许**把桩写成「通用假模型」（只服务这五个 purpose 的最小形状，够用即止）。

### R6 · 明确**不**做的事（转 `Not yet specified`）

- **不**把桩接进 `pnpm up:apps` 默认链路（保持「默认 mock / 无 Gateway」的现状）；
- **不**做本地真模型适配器（Ollama / llama.cpp）；**不**为 worker 的 `contextualize` 桩出 JSON（本图只覆盖问答段；`/v1/embeddings` 端点顺手支持是因为便宜）。
