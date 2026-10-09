# 裁定：`tenantId` 显式化的形状与缺租户时的姿态

Type: grilling
Status: resolved
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

## Answer

**结论：本图原定的改动（把 `tenantId` 显式化并借此收窄语料）**裁定为不改**；而核实过程中挖出的真问题另记（下方「带出的真问题」）。**

### 为什么「不改语料装载的租户来源」

1. **既有测例把它钉成了契约**：`apps/api/tests/acl/dept-acl-ask-e2e.test.ts:327-341` 的 `describe('语料装载的 tenantId 来源（fail-closed）')` 明确构造「文档行 `tenantId=''`」并断言「部门文档不可见、只留空部门（`DOC_LIB`）」。该断言**只有在租户取自文档行时**才成立 —— 若改用入口租户，部门/授权查询会成功，断言立即变红。这不是「断言过严」，是有人在**有意钉住**这条来源。
2. **改动无 PRD 依据**：雾清单簇 8 自己标注「`未核实（PRD 未明写）`」。当前语义（文档行缺租户 → 降级为「只留空部门」）是**fail-closed**，不是放行。
3. **两源在所有可达状态下同值**：`documents.tenant_id` 为 **NOT NULL**（schema），且写路径（`upload-url` / `write` / `complete`）一律写 `kb.tenantId`，无跨租户写入面 → 正常数据下「文档行租户 = KB 租户」。容器里出现异租户行的前提是**数据被外部改坏**。
4. **改动的收益是「消除反推」这一形式目标**，代价是改写一条被钉住的既有语义 + 波及 4 处调用点（含未纳入 CI 的探针脚本）。按「不改冻结语义 / 不为形式目标动语义」，不做。
5. **`requiresTenantId` 那半边不冲突**：ES builder 的硬闸取的是**入口租户**（`retrieve.ts:199` → `es-sparse.ts` 的 `buildAclFilter`），与语料装载的反推值**本来就不是同一个变量** → 本图想收的「同源」在这条路径上不存在（见下条，这是真问题不在装载面）。

### 带出的真问题（本图把目的地重画到这里）

**ask 的租户有**两个**来源，且不同值时口径分裂**：

| 腿 | 取租户处 | 结论 |
|---|---|---|
| ES sparse 过滤 | `apps/api/src/services/retrieve/retrieve.ts:199` = `input.tenantId` = `apps/api/src/routes/ask.ts:314` 的 `auth.tenantId ?? kb.tenantId` | 用**入口租户**（优先 auth） |
| PG 语料 | `apps/api/src/services/retrieve/corpus.ts:64-79`（`where` 只有 `kbId`；租户来自文档行） | 用**KB 的租户** |

`auth.tenantId !== kb.tenantId` 时（例如跨租户成员、或超管以 A 租户会话访问 B 租户的库），ES 稀疏腿按 A 过滤、PG 语料按 B 装；命中再经「只保留语料内 id」求交 → **稀疏召回静默丢失**（不构成泄漏：异租户命中会被语料求交滤掉）。**未实测**（无真 ES 复现）。

**真问题的形状**：这不是装载面的实现债，而是「**ask 的租户权威源是 auth 还是 KB**」的产品 / 契约问题 —— 三种可能处置：① ES 腿改按 `kb.tenantId`（对齐 PG）；② 两者不等即拒绝 ask；③ 明确「跨租户访问不得发生」并加断言（今天是靠成员闸兜）。**三条都须先裁**，故本图不在此处动手。

### 本图其余票

- [03 实现票](./03-task-implement.md)：**不实施**（裁定为不改）。
- [04 回写票](./04-task-writeback.md)：只回写「裁定 + 真问题」到镜像与雾清单，**无代码改动**。
