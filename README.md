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

代码路径已落地（API + worker 状态机 + mock 模式）：

| 步骤 | API / 行为 |
|------|------------|
| 建库 | `POST /api/v1/knowledge-bases` |
| 上传 | `upload-url` → `PUT /api/v1/internal/objects` → `complete`（权威 size 闸） |
| 审批 | `POST /api/v1/documents/:id/approve`；未批 scan → `FORBIDDEN` |
| 入库 | `POST .../scan` → worker：scan→parse→chunk→embed→es（串行双就绪） |
| 发布 | `PATCH .../lifecycle` → `active`（仅 `status=ready`） |

演示步骤见 [`scripts/demo-ingest.md`](./scripts/demo-ingest.md)；样例文 `fixtures/ingest-samples/`（10 篇）。

Mock 开关（`.env`）：`INGEST_SCAN_MODE` · `INGEST_ES_MODE=fail`（验证不得 ready）· `STORAGE_MODE=local`。

> 本机需 Docker 起 PG/Redis 后 `pnpm db:migrate` 才能做 live 联调。ES/RustFS 生产路径仍可按 profile 扩展。

---

## 文档入口

1. **实施规格（SSOT）**：[`prds/README.md`](./prds/README.md)  
2. **交付配套总目**：[`prds/12-delivery-guides/README.md`](./prds/12-delivery-guides/README.md)  
3. **工程开工**：[`prds/12-delivery-guides/06-工程开工.md`](./prds/12-delivery-guides/06-工程开工.md)  
4. **Sprint0 检查单**：[`prds/12-delivery-guides/07-Sprint0检查单.md`](./prds/12-delivery-guides/07-Sprint0检查单.md)  
5. **Agent**：[`CLAUDE.md`](./CLAUDE.md)

---

## 硬约束（摘要）

- 规格冲突以 **`prds/00–11`** 为准；`12-delivery-guides` 仅辅助  
- 四层控制：检索 → 约束生成 → 声明验证 → 拒答  
- **min 否决**；历史会话 ≠ 证据  
- 禁止 Prisma 并行；ORM 仅 Drizzle  
- Phase 0：**无**入库 / 问答 / 鉴权业务逻辑  

---

## 来源说明

规格与交付材料自 `rag-zero-hallucinations` 迁入。教学 Notebook / 上游教程未迁入本仓。
