# 阶段脚手架规则（Phase Scaffold）

> 适用：当前仓库状态（**P0/P1 入库** + **S2 最小 ask** + **08-11 工程项归档**）。  
> 权威分期：`prds/10-delivery/01-phased-roadmap.md` · 项目导航：`CLAUDE.md`。  
> 已关 epic：`archive/2026-08/08-05-phase-2-ask`（S2 最小，≠ 全文 Phase 2）。  
> 08-11 归档：`archive/2026-08/08-11-*`（含 QUAL-2 **延期安全债**）。总 backlog：`08-06-project-backlog/status.md`。

---

## 当前事实（代码实态）

| 单元 | 现状 | 证据 |
|------|------|------|
| `apps/api` | 入库 + 鉴权 hydrate + ask + B1–B6 + B12 策略 + B13 feedback + Gateway resolve + L1 CLI | `apps/api/src/**` |
| `apps/worker` | BullMQ + ingest；**mock scan**（真杀毒债） | `apps/worker/src/**` |
| `apps/web` | S2 ask UI + B13 反馈提交 | `apps/web/src/**` |
| `apps/admin` | S2c 薄页 + B1–B6 + 反馈队列 | `apps/admin/src/**` |
| `packages/contracts` | BizCode · 信封 · auth · ingest · ask 域 | `packages/contracts/src/**` |
| `packages/db` | schema + migrate + retrieval-gate + ask + **eval_runs** | `packages/db/src/**` |
| `packages/ui` | `cn()` + `theme.css` | `packages/ui/src/**` |
| `packages/admin-catalog` | 权限码 + 角色模板 + 菜单 | `packages/admin-catalog/src/**` |
| `docker/` | PG+Redis 默认；es/mongo/rustfs profile | `docker/docker-compose.yml` |

**默认边界**：`RETRIEVE_ES_MODE=mock` · Gateway 可 mock · `AUTH_ENFORCE=false` · **rewrite 强制 false** · `INGEST_SCAN_MODE=mock_clean`。  
**未做**：Better Auth 生产 IdP · 真 ES+IK（B8）· **真杀毒（QUAL-2）** · CRAG/multi_hop · 完整运营台 · **L1 业务签字真跑**。  
**已做工程（非签字）**：B10 L1 seed + `eval_runs` + OPS-1 profile — HOW [l1-eval](../api/backend/l1-eval.md)。

---

## 允许

### 已交付阶段（维护 / 修 bug / 加深单测）

- P0 骨架 · P1 S1 入库 · **S2 最小 ask** 的维护与诚实边界内增强  
- 交付文档 / `docs/module-status` 回写（非 `00–11` 契约）  
- 按 backlog **新建** Trellis feature 后实现 B1/B8 等

### 新能力编码（须）

1. 有明确 task（勿 silently 塞进已归档 epic）  
2. 触及 ask 时读 [quality-redlines](./quality-redlines.md) + [ask-pipeline](../api/backend/ask-pipeline.md)  
3. 改冻结语义：ADR → PRD → 再编码  

---

## 禁止

| 禁止 | 原因 |
|------|------|
| 宣称「全文 Phase 2 / 生产 ES 已上 / 生产杀毒已上」 | S2 最小 / mock / DEC-SCAN 边界 |
| 未 P2.5 二元出口进入 P3a CRAG | 路线图硬门 |
| `SESSION_REWRITE_ENABLED=true` 合入 | P2 配置拒绝；P2.5+ 再议 |
| Better Auth 无设计半吊子落地 | 须收敛设计 |
| route 内散落 SQL / ES DSL / 长 Prompt | 架构冻结 |
| 引入 Prisma / TypeORM 并行 | 技术栈冻结 |
| npm / yarn；第二 monorepo | 工程基线 |
| 把 `12-delivery-guides` / `module-status` 当接口契约覆盖 `00–11` | SSOT |
| 静默放宽 ADR（如 rerank 跳过仍 answered） | 质量红线 |
| 暗示业务已全部完成 | 提交说明写清做了/未做 |

---

## 与 HOW 文档

- Ask 实现：`.trellis/spec/api/backend/ask-pipeline.md`  
- IS 完成度：`docs/module-status/`  
- 产品契约：`prds/00–11`
