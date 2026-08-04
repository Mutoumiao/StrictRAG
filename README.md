# StrictRAG

**为精准度而生的严厉企业知识库 RAG。**

宁拒勿妄 · 证据优先。

---

## 仓库结构

```text
StrictRAG/
├── apps/
│   ├── admin/          # Next.js 管理端（空壳 · 端口 3006）
│   ├── web/            # Next.js 用户端（空壳 · 端口 3005）
│   ├── api/            # Hono + Node（health/ready · 端口 4000）
│   └── worker/         # BullMQ 消费者（探针队列）
├── packages/
│   ├── contracts/      # BizCode · ApiResponse · Zod（按域）
│   ├── admin-catalog/  # 权限码 + 菜单（ADR-056）
│   ├── db/             # Drizzle schema + migrate
│   ├── ui/             # cn() · theme.css
│   ├── eslint-config/
│   └── typescript-config/
├── prds/               # 生产规格 SSOT（00–11）+ 交付配套（12）
├── docker/             # 本地依赖 compose
└── CLAUDE.md           # Agent 指令与仓库导航
```

---

## 快速开始（Phase 0）

需要：**Node.js 20+**、**pnpm 10+**、Docker Compose。

```bash
# 1) 依赖
pnpm install
cp .env.example .env

# 2) 基础设施（PG + Redis）
docker compose -f docker/docker-compose.yml up -d

# 3) 数据库 migrate
pnpm db:migrate

# 4) 类型 / lint / 单测 / 构建
pnpm check-types
pnpm lint
pnpm test
pnpm build

# 5) 起服（分终端）
pnpm dev:api      # http://127.0.0.1:4000
pnpm dev:worker   # BullMQ probe
pnpm dev:web      # http://127.0.0.1:3005
pnpm dev:admin    # http://127.0.0.1:3006
```

### 健康检查

```bash
curl -sS http://127.0.0.1:4000/health
curl -sS http://127.0.0.1:4000/ready
```

| 端点 | 语义 |
|------|------|
| `GET /health` | 进程存活（不依赖外部） |
| `GET /ready` | PG + Redis 硬依赖；ES/Gateway 未配置则 `skipped` |

### Compose 扩展 profile

见 [`docker/README.md`](./docker/README.md)（`es` / `mongo` / `rustfs`）。

### 模型 Gateway

服务端 env：`GATEWAY_BASE_URL`、`GATEWAY_API_KEY`（**禁止**进 web/admin）。  
未配置时 ready 中 `gateway=skipped`。有 Key 后 `/ready` 会探测 `GET {base}/v1/models`。

### tauClaim

唯一配置源：`TAU_CLAIM`（0–1）。若同时设 `TAU_CLAIM_LEGACY` 且值不同 → **启动失败**（防双源）。

---

## Phase 1 入库闭环（S1 最小）

代码路径已落地（API + worker 状态机 + **mock 嵌入/ES**）：

| 步骤 | API / 行为 |
|------|------------|
| 建库 | `POST /api/v1/knowledge-bases` |
| 上传 | `upload-url` → `PUT /api/v1/internal/objects` → `complete`（权威 size 闸） |
| 审批 | `POST /api/v1/documents/:id/approve`；未批 scan → `FORBIDDEN` |
| 入库 | `POST .../scan` → worker：scan→parse→chunk→embed→es（串行双就绪） |
| 发布 | `PATCH .../lifecycle` → `active`（仅 `status=ready`） |

### 一键演示 / 回归

```bash
# 终端 1–2：api + worker；Docker PG+Redis；已 migrate
pnpm demo:ingest          # 同 KB ≥10 fixtures → ready → active
# 别名：pnpm test:e2e-ingest
```

说明见 [`scripts/demo-ingest.md`](./scripts/demo-ingest.md)；样例 `fixtures/ingest-samples/`（10 篇）。

Mock 开关（`.env`）：`INGEST_SCAN_MODE` · `INGEST_ES_MODE=fail`（验证不得 ready）· `STORAGE_MODE=local`。

> **边界（勿过度宣称）**：P1 的「ES」是 worker **进程内 mock** 对账，**不是** 生产 Elasticsearch+IK 集群。`/ready` 中 `elasticsearch=skipped` 属正常。真 ES/RustFS 按 compose profile 后续接入。

---

## 文档入口

1. **实施规格（SSOT）**：[`prds/README.md`](./prds/README.md)  
2. **交付配套总目**：[`prds/12-delivery-guides/README.md`](./prds/12-delivery-guides/README.md)  
3. **对内交付状态**：[`prds/12-delivery-guides/04-交付控制台.md`](./prds/12-delivery-guides/04-交付控制台.md) §0（P0/P1 已交付 · P2 未编码）  
4. **工程下一刀**：[`prds/12-delivery-guides/06-工程开工.md`](./prds/12-delivery-guides/06-工程开工.md)（S2 设计评审 → Phase 2）  
5. **Sprint0 检查单（历史勾选）**：[`prds/12-delivery-guides/07-Sprint0检查单.md`](./prds/12-delivery-guides/07-Sprint0检查单.md)  
6. **Agent**：[`CLAUDE.md`](./CLAUDE.md)

---

## 硬约束（摘要）

- 规格冲突以 **`prds/00–11`** 为准；`12-delivery-guides` 仅辅助  
- 四层控制：检索 → 约束生成 → 声明验证 → 拒答  
- **min 否决**；历史会话 ≠ 证据  
- 禁止 Prisma 并行；ORM 仅 Drizzle  
- Phase 0 历史范围定义曾写「无入库/问答」；**现状**以 P0/P1 已交付为准（见交付控制台 §0）；鉴权为临时双 JWT + `AUTH_ENFORCE`，**非**生产 IdP

---

## 来源说明

规格与交付材料自 `rag-zero-hallucinations` 迁入。教学 Notebook / 上游教程未迁入本仓。
