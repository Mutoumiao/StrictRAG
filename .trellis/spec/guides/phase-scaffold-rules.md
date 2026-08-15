# 阶段门禁规则（允许 / 禁止边界）

> 适用：写代码前的 **允许做什么 / 禁止宣称什么**。  
> 权威分期：`prds/10-delivery/01-phased-roadmap.md` · 项目导航：`CLAUDE.md`。  
> 已关 epic：`archive/2026-08/08-05-phase-2-ask`（S2 最小，≠ 全文 Phase 2）。  
> 总调度：`08-06-project-backlog/status.md` · HOW 债：`08-12-spec-arch-review-backlog`。

---

## 阶段摘要（非完成度 SSOT）

> **完成度 / 已具备 / 债** 以 **源码 + [`docs/module-status/`](../../../docs/module-status/README.md)** 为准。  
> 本节只给 Agent 快速边界；**禁止**用本表抬成熟度或替代 module-status。

| 维度 | 摘要（细节 → module-status） |
|------|------------------------------|
| 已落地主轴 | P0/P1 入库 · S2 最小 ask · S2c 运营薄页 · 若干接线/策略/反馈 |
| 默认依赖 | ES mock · Gateway 可 mock · `AUTH_ENFORCE` 默认关 · rewrite **默认关**（dogfood 可开） · scan `mock_clean` |
| 明确未做 / 债 | 生产 ES+IK（B8）· 真杀毒（QUAL-2）· L1 业务人签/ADR-046（真跑数字已落）· CRAG/multi_hop · 完整运营台 · Better Auth 生产 IdP |

**IS 入口**：[`docs/module-status/README.md`](../../../docs/module-status/README.md)（能力矩阵 + 包文）。

---

## 允许

### 已交付阶段（维护 / 修 bug / 加深单测）

- P0/P1 入库 · **S2 最小 ask** · S2c 薄页 在诚实边界内的维护与单测加深  
- 交付文档 / `docs/module-status` 回写（非 `00–11` 契约）  
- 按总 backlog **新建** Trellis feature 后实现 **未完成** 项（例：B8 · QUAL-2 · B10 签字真跑 · DEPT_ACL UI）

### 新能力编码（须）

1. 有明确 task（勿 silently 塞进已归档 epic）  
2. 触及 ask 时读 [quality-redlines](./quality-redlines.md) + [ask-pipeline](../api/backend/ask-pipeline.md)  
3. 改冻结语义：ADR → PRD → 再编码  
4. 判断「齐了吗」只查 **module-status + 源码**，不查本文件历史表

---

## 禁止

| 禁止 | 原因 |
|------|------|
| 宣称「全文 Phase 2 / 生产 ES 已上 / 生产杀毒已上」 | S2 最小 / mock / DEC-SCAN 边界 |
| 未 P2.5 二元出口进入 P3a CRAG | 路线图硬门 |
| 合入 **默认** `SESSION_REWRITE_ENABLED=true` / 对外宣传连续追问 | 图边可 dogfood；默认开须 L2 准出 |
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
