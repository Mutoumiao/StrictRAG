# Thinking Guides · StrictRAG

> 目的：在写代码前扩展思考面，避免跨层 bug、重复实现、静默放宽质量门。

---

## 本仓库必读顺序

1. **[阶段门禁规则](./phase-scaffold-rules.md)** — 允许/禁止什么（完成度见 module-status）  
2. **[Monorepo 边界](./monorepo-boundaries.md)** — 包依赖方向与禁项  
3. **[质量红线](./quality-redlines.md)** — RAG 宁拒勿妄（触及 ask/入库/verify 时必读）  
4. 功能跨层时 → **[跨层思考](./cross-layer-thinking-guide.md)**  
5. 出现重复代码/常量时 → **[复用思考](./code-reuse-thinking-guide.md)**  
6. **包级 checklist** → 打开目标包 `.trellis/spec/<pkg>/<layer>/index.md` 的 **Pre-Development Checklist**，并读其列出的专文（**X-17**：guides 不替代包 index）

```text
guides（本目录）     →  跨包思考 / 红线 / 边界
        ↓ 第 6 步
spec/<pkg>/<layer>/  →  包内 HOW + checklist + 专文
        ↓
源码 + docs/module-status  →  IS 真相
```

| 你改… | 第 6 步打开 |
|--------|-------------|
| `apps/api` | [api/backend/index](../api/backend/index.md)（ask → [ask-pipeline](../api/backend/ask-pipeline.md)） |
| `apps/worker` | [worker/backend/index](../worker/backend/index.md) |
| `apps/web` / `apps/admin` | [web](../web/frontend/index.md) / [admin](../admin/frontend/index.md) |
| `packages/db` | [db/backend/index](../db/backend/index.md) |
| `packages/contracts` | [contracts/library/index](../contracts/library/index.md) |
| `packages/admin-catalog` | [admin-catalog/library/index](../admin-catalog/library/index.md) |

---

## 指南索引

| 指南 | 何时使用 |
|------|----------|
| [phase-scaffold-rules](./phase-scaffold-rules.md) | 任何实现任务开工前 |
| [monorepo-boundaries](./monorepo-boundaries.md) | 新增包、跨包 import、放逻辑位置 |
| [quality-redlines](./quality-redlines.md) | 检索 / 生成 / 验证 / 拒答 / 门禁；**P0 自动化表指针** |
| [cross-layer-thinking-guide](./cross-layer-thinking-guide.md) | 数据穿越 api↔db↔worker↔web |
| [code-reuse-thinking-guide](./code-reuse-thinking-guide.md) | 改常量、抽 helper、复制粘贴前 |
| **包 `index.md` checklist** | **第 6 步必达**（X-17）；非本目录文件 |

---

## 快速触发清单

### 跨层

- [ ] 功能触及 2+ 个 app/package  
- [ ] 新增/改动 DTO、BizCode、错误信封  
- [ ] 写库时间、ID、env 校验  
- [ ] 前端展示后端业务码  
- [ ] 登录 / refresh / Bearer / 权限码 / 菜单裁剪  

→ [cross-layer-thinking-guide](./cross-layer-thinking-guide.md) · [contracts](../contracts/library/index.md) · [auth-authorization](../api/backend/auth-authorization.md) · [catalog-ssot](../admin-catalog/library/catalog-ssot.md)

### 质量 / RAG

- [ ] 任何 ask 路径、retrieve、generate、verify  
- [ ] 改阈值 / mode / citation 策略  
- [ ] 「先答了再说」或「降级仍 answered」的诱惑  
- [ ] L1 黄金集 / 覆盖率 / 批跑 CLI / 是否把 mock 数字当签字  
- [ ] 入库 scan / 宣称杀毒完成（DEC-SCAN）  
- [ ] rerank 节点数 / 多策略 reindex  

→ [quality-redlines](./quality-redlines.md) · `prds/08-quality/` · `docs/testing/p0-redlines.md` · [l1-eval](../api/backend/l1-eval.md) · [worker quality](../worker/backend/quality-guidelines.md) · [chunk-strategies](../api/backend/chunk-strategies.md)

### 运维文档（非 code-spec，但签字/债锚点）

| 路径 | 来源 task |
|------|-----------|
| `docs/ops/live-retrieve-profile.md` | OPS-1 |
| `docs/ops/at-rest-checklist.md` | OPS-2 |
| `docs/ops/feedback-sla.md` | B13 |
| `docs/ops/rate-limit-and-metrics.md` | ARCH-P2-4 |
| `fixtures/l1/RACI.md` | B10-RACI |

### 包边界

- [ ] route handler 里想写 SQL / ES DSL / 长 Prompt  
- [ ] 密钥或 `DATABASE_URL` 想进 web/admin  
- [ ] schema 只想放在 `apps/api`  

→ [monorepo-boundaries](./monorepo-boundaries.md)

---

## 修改前先搜（CRITICAL）

```bash
# 改任何常量 / 业务码 / 配置键前
rg "value_to_change" .
```

---

**核心原则**：30 分钟想清边界，胜过 3 小时修跨层 bug。规格变更走 ADR → 改 PRD → 升 `prds/README.md` 版本。
