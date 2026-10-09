# 裁定：`tenantId` 显式化的形状与缺租户时的姿态

Type: grilling
Status: open
Blocked by: 01

## Question

按工单 01 的核实结果逐条裁定（每条给**依据出处**，不改 `prds/00–11`）：

1. **入参形状**：`CorpusLoader` 入参加 `tenantId: string`（必填）还是 `tenantId?: string`？依据 = 前图 QUAL-TENANT-Q 的既有口径（ES builder 缺租户**即抛**）与 `RetrieveInput.tenantId` 已是必填这一事实。
2. **缺租户的姿态**：若入口拿不到租户（理论上不该发生），装载应 **fail-closed（抛/拒答）** 还是 **只按 `kbId` 收**（与今天逐位一致）？给出选择、理由与它对「逐位不变」的影响。
3. **加闸位置**：`eq(documents.tenantId, tenantId)` 加在语料查询上，还是只在装载入口做参数校验、查询不动？比较两种做法的**泄漏面**与**回归面**。
4. **可见性上下文**：`loadVisibilityContext` 的 `subject.tenantId` 改用入口租户后，部门 / grant 的读取面是否仍走同一条 SQL？有无跨租户读面被意外收窄或放宽？
5. **ES 侧一致性**：`retrieve.ts` 传给 `sparseSearch` 的 `tenantId` 今天来自哪里？与本图显式化的入口租户是否同源？（若今天已同源，说明 ES 闸与语料闸口径不一致，正是本图要收的口子。）
6. **测试策略**：如何钉住「跨租户行不进语料」而不造假绿？（建议：夹具里放一条异租户文档行，断言它不进语料 / 不被检索命中；并作**反证**。）
7. **不做清单**：本图明确不做的项（schema 约束 / 多租户独立索引 / 产品级无租户拒答语义）。
