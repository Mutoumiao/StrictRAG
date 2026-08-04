# Thinking Guides · StrictRAG

> 目的：在写代码前扩展思考面，避免跨层 bug、重复实现、静默放宽质量门。

---

## 本仓库必读顺序

1. **[骨架阶段规则](./phase-scaffold-rules.md)** — 当前允许/禁止什么  
2. **[Monorepo 边界](./monorepo-boundaries.md)** — 包依赖方向与禁项  
3. **[质量红线](./quality-redlines.md)** — RAG 宁拒勿妄（触及 ask/入库/verify 时必读）  
4. 功能跨层时 → **[跨层思考](./cross-layer-thinking-guide.md)**  
5. 出现重复代码/常量时 → **[复用思考](./code-reuse-thinking-guide.md)**

---

## 指南索引

| 指南 | 何时使用 |
|------|----------|
| [phase-scaffold-rules](./phase-scaffold-rules.md) | 任何实现任务开工前 |
| [monorepo-boundaries](./monorepo-boundaries.md) | 新增包、跨包 import、放逻辑位置 |
| [quality-redlines](./quality-redlines.md) | 检索 / 生成 / 验证 / 拒答 / 门禁 |
| [cross-layer-thinking-guide](./cross-layer-thinking-guide.md) | 数据穿越 api↔db↔worker↔web |
| [code-reuse-thinking-guide](./code-reuse-thinking-guide.md) | 改常量、抽 helper、复制粘贴前 |

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

→ [quality-redlines](./quality-redlines.md) · `prds/08-quality/`

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
