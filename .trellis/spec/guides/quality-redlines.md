# 质量红线（RAG · 宁拒勿妄）

> **WHAT** 权威：`prds/08-quality/` · `prds/04-pipelines/`  
> **HOW**：本文件约束实现与评审时不可越过的底线。  
> 触及 ask / 检索 / 生成 / 验证时 **必读**。

---

## 四层控制（不可跳步）

```text
检索 → 约束生成 → 声明验证(verify) → 拒答或 answered
```

| 规则 | 含义 |
|------|------|
| **min 否决** | 不因「整体看起来还行」均值洗白；claim 级不达标 → 整答拒答 |
| **合法 draft 必 verify** | 禁止跳过 verify 直接 `answered` |
| **历史 ≠ evidence** | 会话历史不得当作 citation / min_support 对齐文本 |
| **门禁只加严不放宽** | 生产路径禁止用 flag 静默放宽 |
| **双就绪 ∧ active** | 文档/chunk 检索闸：索引就绪且状态 active |

---

## 实现禁忌清单

| 禁忌 | 正确做法 |
|------|----------|
| rerank 失败/跳过仍 `answered` | 拒答；reason 如 `rerank_unavailable`（ADR-030/034） |
| claim 拆分失败仍出答 | 拒答 `claim_split_failed`；禁止并入模糊 internal_guard |
| 非法 citation 剥光后仍 verify | `invalid_citations` finalize（见 PRD §3） |
| 在线路径字段级脱敏分裂原文 | 脱敏只在入库权威 body；单一真相 ADR-037 |
| 客户端传 `tauClaim` / `retrieveK` 等 | `options` **仅** stream / debug / mode / locale（`prds/05-api` §1.1） |
| 把 `scope` 塞进 `options` | **`scope` 为 ask 顶层可选字段**（如 `scope.docTypes`），与 options **分轨**（ADR-050）；混入 options → 400 |
| 教学 Notebook / LanceDB 数字当 SLA | 生产指标以验收剧本与门禁为准 |

### ask 请求形状（摘要）

```text
{
  // ...
  options?: { stream?, debug?, mode?, locale? }   // 仅此四字段
  scope?: { docTypes?: string[] }                 // 顶层；不是 options
}
```

---

## Citation 铁律（摘要）

用户可见 `answered` 响应中，`citations[]` **只能**含本轮 evidence 内 id。  
全文 `INSUFFICIENT_EVIDENCE` → 不进 verify → `model_abstained`。  
细节与分档：`prds/08-quality/01-verification-and-abstention.md`。

---

## 与骨架阶段关系

当前 **无** ask 运行时。本红线用于：

1. 评审 PRD 实现任务是否放宽冻结语义  
2. Phase 2 起写 LangGraph 节点时的检查单  
3. 禁止「为了 demo 先通」的临时绕过合入 main

**不要**在骨架阶段为「预埋」而复制一整套假 verify；按 Phase 落地。

---

## 评审检查句式

- 该改动是否让 **拒答变少** 却无对应 ADR？  
- evidence 文本在 generate 与 verify 是否 **同一切片**？  
- 失败路径是否有 **稳定 reason 码**（非吞掉异常）？
