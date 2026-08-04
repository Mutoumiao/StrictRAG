# StrictRAG

**为精准度而生的严厉企业知识库 RAG。**


## 仓库结构

```text
StrictRAG/
├── apps/
│   ├── admin/          # Next.js 管理端（占位 · 目标端口 3006）
│   ├── web/            # Next.js 用户端（占位 · 目标端口 3005）
│   ├── api/            # Hono + Node（占位 · 目标端口 4000）
│   └── worker/         # BullMQ 消费者（占位）
├── packages/
│   ├── contracts/      # BizCode · ApiResponse · Zod（按域）
│   ├── admin-catalog/  # 权限码 + 菜单（ADR-056）
│   ├── db/             # Drizzle schema（api/worker 共用）
│   ├── ui/             # cn() · theme.css（子路径 exports）
│   ├── eslint-config/
│   └── typescript-config/
├── prds/
│   ├── 00–11…          # 生产规格 SSOT
│   └── 12-delivery-guides/  # 交付配套（非接口 SSOT）
├── docker/             # 本地依赖 compose 骨架
├── product.pen         # 设计线稿
└── CLAUDE.md           # Agent 指令与仓库导航
```

---

## 快速开始（骨架）

```bash
# 需要 Node.js 20+、pnpm 10+
pnpm install
pnpm check-types
pnpm lint

# 本地基础设施（可选：PG + Redis）
docker compose -f docker/docker-compose.yml up -d
```

> 当前 `dev` / `start` 仅为占位提示，**不会**启动真实 HTTP。  
> Phase 0：health/ready、migrate、真 dev；契约信封已在 `packages/contracts`。

---

## 文档入口

1. **实施规格（SSOT）**：[`prds/README.md`](./prds/README.md)  
2. **交付配套总目**：[`prds/12-delivery-guides/README.md`](./prds/12-delivery-guides/README.md)  
3. **工程开工**：[`prds/12-delivery-guides/06-工程开工.md`](./prds/12-delivery-guides/06-工程开工.md)  
4. **交付编排**：[`prds/12-delivery-guides/04-交付控制台.md`](./prds/12-delivery-guides/04-交付控制台.md)  
5. **Agent**：[`CLAUDE.md`](./CLAUDE.md)

---

## 硬约束（摘要）

- 规格冲突以 **`prds/00–11`** 为准；`12-delivery-guides` 仅辅助  
- 四层控制：检索 → 约束生成 → 声明验证 → 拒答  
- **min 否决**；历史会话 ≠ 证据  
- 禁止 Prisma 并行；ORM 仅 Drizzle  
- 本阶段：**仅骨架，无入库/问答/鉴权业务逻辑**

---

## 来源说明

规格与交付材料自 `rag-zero-hallucinations` 迁入；原根目录 `docs/` 已并入 `prds/12-delivery-guides/`。教学 Notebook / 上游 `00–11` 教程未迁入本仓。
