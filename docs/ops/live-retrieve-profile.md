# 签字 Live 检索 Profile（OPS-1）

| 字段 | 内容 |
|------|------|
| **Owner** | 后端 / 运维（评测跑批人） |
| **状态** | 可运营最小 live（B8 **切片**） |
| **非目标** | 生产 ES+IK 全文、多租户 Router、入库自动双写（仍归 B8） |

---

## 1. 一句话

签字包只接受 **`retrieve_mode=live`** 的 L1 报告。  
`RETRIEVE_ES_MODE=mock`（默认）的数字 **禁止** 写入业务签字页。

| `RETRIEVE_ES_MODE` | sparse | L1 `retrieve_mode` | `signoffEligible` |
|--------------------|--------|--------------------|-------------------|
| `mock`（默认） | 进程内 token 重叠 | `mock` | `false` |
| `http` + 可答/不可答类各≥30 | ES BM25 `_search` | `live` | `true`（仍须人审；≠ 业务 PASS） |
| `http` + `L1_MAX_CASES` 截断 / 缺类 | 同上 | `live` | `false`（规模门） |

失败时 **禁止** 静默回落 mock：http 模式缺 URL / ES 挂掉 → ask/retrieve `internal_guard`。

---

## 2. 环境

```bash
# compose ES（可选 profile）
docker compose -f docker/docker-compose.yml --profile es up -d

# api .env（勿改仓库默认 mock）
ELASTICSEARCH_URL=http://127.0.0.1:9200
ELASTIC_INDEX=strict_rag_dev          # 可选，默认此值
RETRIEVE_ES_MODE=http                 # 仅签字/live 会话打开
```

| 变量 | 说明 |
|------|------|
| `ELASTICSEARCH_URL` | 空则 ready 中 ES=`skipped`；http 模式检索 **必填** |
| `ELASTIC_INDEX` | 共享切片索引名；≠ 生产 Router |
| `RETRIEVE_ES_MODE` | **默认保持 mock**；live 会话显式 `http` |

代码锚：

- sparse 实现：`apps/api/src/services/retrieve/es-sparse.ts`
- 注入：`createDefaultRetrieveDeps`（`retrieve.ts`）
- L1：`apps/api/src/scripts/run-l1-golden.ts` → `retrieve_mode` + `signoffEligible`

---

## 3. 探针（归因 mock vs live）

### 3.1 种子 + 抽样 search

Worker 入库 ES 仍为 mock；签字前须把 **PG ready∧active chunks** bulk 进 ES：

```bash
export ELASTICSEARCH_URL=http://127.0.0.1:9200
export L1_KB_ID=<已入库 kb-uuid>
pnpm --filter @strict-rag/api exec tsx src/scripts/seed-es-sparse-probe.ts
```

（探针与 L1 共用 `L1_KB_ID`。）

期望 stdout：`ok: true`，`retrieve_mode: "live"`，`sampleHits > 0`。

### 3.2 L1 批跑（live）

```bash
export RETRIEVE_ES_MODE=http
export ELASTICSEARCH_URL=http://127.0.0.1:9200
export L1_KB_ID=<kb-uuid>
# 可选截断冒烟
export L1_MAX_CASES=5
pnpm --filter @strict-rag/api exec tsx src/scripts/run-l1-golden.ts
```

检查 `artifacts/l1-last-run.json`：

```json
{
  "retrieve_mode": "live",
  "mode": "live",
  "signoffEligible": false,
  "answerableCount": 5,
  "unanswerableClassCount": 0
}
```

全量（不设 `L1_MAX_CASES`，gold 各≥30）才可能 `signoffEligible: true`。

### 3.3 失败归因

| 现象 | 归因 |
|------|------|
| 报告 `retrieve_mode=mock` | 未设 `RETRIEVE_ES_MODE=http` → **不得**进签字包 |
| ask `internal_guard` + `ELASTICSEARCH_URL` / sparseSearch | http 开了但无 URL 或未注入 |
| `ES sparse failed (http|timeout)` | ES 宕机 / 索引空 / 网络 |
| 探针 `empty_corpus` | KB 无 ready∧active；先跑入库 |
| 探针 `sampleHits=0` | bulk 未 refresh / 问句无命中 / kbId 过滤错 |

---

## 4. 签字包门禁（硬）

1. 只收 `retrieve_mode=live` **且** `signoffEligible=true` 的 `l1-last-run.*`。  
2. `mock` 或 `unknown` → 拒收；不得改报告头假装 live。  
3. 本 profile **≠** 宣称生产 ES+IK / 多租户已上。  
4. 业务签字真跑规模（各≥30）见 **B10-followup**（硬依赖 OPS-1 ∧ B3-W）。  
5. **Gateway 非仅 env（B3-W）**：签字 live 会话须已配置 platform `model_bindings`（admin 模型绑定）；运行时 `bindingSource` 为 `mixed`/`db`。仅 env 绿灯 **不得** 当业务签字成绩单（B3-W 后须重跑）。

---

## 5. 边界话术

| 完成 | 未完成 |
|------|--------|
| 签字 live profile 可运营 | 全文 B8 |
| 非 mock sparse 可复现 | 入库 worker 写真 ES |
| L1 可区分 retrieve_mode | 默认仓库改为 http |
