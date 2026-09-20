# 裁定：「同一可见性函数」的形态与落点

Type: grilling
Status: resolved
Blocked by: 01

## 问题

按 ADR-057 `prds/11-decisions/00-adr-index.md:1867`「列表预览、chunk 查看、ask evidence **同一可见性函数**」，把今天五份组装（见 `01-research-visibility-seams.md` 的对照表）收敛成一处，需要先定形态。

## Answer

**裁定：抽出 `apps/api/src/services/retrieve/visibility.ts`，作为唯一「部门 + principals 组合」入口；四个活入口改为调用它；死代码 `hasRetrievableDocs` 删除。本步不引入请求级缓存。**

### 1. 依据（为何可安全收敛）

研究结论是五处**行为等价**（无放宽拷贝、无漏 grant、无漏 `deptInheritDown`、无顺序反转），唯一"近似拷贝" `hasRetrievableDocs` 是**死代码**（全仓 3 命中：定义 `apps/api/src/services/retrieve/corpus.ts:146`、再导出 `retrieve/index.ts:3`、注释 `corpus.ts:28`；无调用方）。因此收敛是**结构变更、非语义变更** —— 这正是 ADR-057 要的"同一函数"的目的：防止未来四处漂移。

### 2. 形态（决定）

```ts
// apps/api/src/services/retrieve/visibility.ts（纯函数，无 IO 之外副作用）
export type VisibilitySubject = { tenantId: string; userId?: string; bypass: boolean };
export type VisibilityContext = {
  enforce: boolean; inheritDown: boolean; now: string;
  assignments: readonly DeptAssignment[]; depts: readonly DeptAclNode[]; grants: readonly DeptAclGrant[];
};
export async function loadVisibilityContext(input: {
  subject: VisibilitySubject; enforce: boolean; inheritDown: boolean; now?: string;
}): Promise<VisibilityContext>;                       // 唯一三连加载处；!enforce||bypass 时短路为空 ctx
export function isDocVisible(doc: DeptAclDoc & { aclPrincipals?: string[] | null },
  subject: VisibilitySubject, ctx: VisibilityContext): { ok: true } | { ok: false; reason: 'dept' | 'principals' };
export function filterVisibleDocs<T extends …>(docs, subject, ctx): T[];
```

- **IO 归属**：`loadVisibilityContext` 是唯一 `Promise.all(loadDeptAssignments, loadDeptNodes, loadDeptGrants)` 处；**是否调用**仍由调用方按 `enforce/bypass` 决定 —— 这样既保持①②③的"关则不查"，也保持④⑤的零 IO。IO 端口以参数注入（默认绑现有 repo），保持既有测例的 `vi.mock` 手法可用。
- **顺序固定**：部门 → principals（今天五处一致），`isDocVisible` 里以 `reason` 区分"部门否"与"名单否"，供调用方映射 403 文案。
- **不引入请求级缓存**：缓存虽能省掉"详情 + ACL 名单"同请求内的重复加载（现 `documents/index.ts:789`/`:871` 各 load 一遍），但会引入**请求内失效语义**（同一请求内若发生写操作，缓存即陈旧）。本步目标是"同一函数"，不是性能；缓存在本图记为不做（见 map「Not yet specified」）。
- **成员闸不在函数内**：`createDocMemberGate` 仍是外层（ADR-009 `:151` 的"检索层二次成员断言"由调用链承担，今天如此，收敛后仍如此）。
- **必须保留的差异**（不得被"统一"掉）：
  1. **超管 bypass 通道**：路由层直判角色（`roleBypassesKbMembership`），检索层读 `membership` 槽（`routes/eval.ts:321`、`scripts/run-l1-golden.ts:413`、`run-l2-golden.ts:260` 刻意硬编码 `'member'` 使跑批不 bypass）。收敛**只统一函数内部**，bypass 仍由调用方作为 `subject.bypass` 传入。
  2. **tenantId 来源**：优先取请求权威 `tenantId`（`RetrieveInput.tenantId` 已有，`retrieve/types.ts:40`）；无权威来源的路由侧沿用文档行，但**新增不得**再引入第四种取法。修 `CorpusLoader` 不传 tenantId 的接口缺口属本图任务 `08` 的可做项（fail-closed 方向，非泄漏）。
  3. **输出形态**：①④取集合、②③⑤取 bool、②③的 403 文案由调用方按 `reason` 映射。
  4. `filterDocsForRetrieve`（ready ∧ active ∧ 窗口 ∧ docTypes）**不并入**可见性函数：它是 ADR-057 `:1856-1864` 求交公式里的独立项，混进来会把"双就绪闸"与"ACL"耦合成一处。

### 3. 死代码处置

删除 `hasRetrievableDocs` 及其再导出（`retrieve/index.ts:3` 的对应符号；`filterDocsForRetrieve` 保留）。理由：ADR-057 要求"同一函数"，留一份无调用方的近似拷贝正好是未来漂移的种子；它不是闸（无调用方 = 无安全作用）。删除属**纯删除**，不改任何行为。
**若删后发现需要"空库判定"**：那时应以 `loadVisibilityContext` + `filterVisibleDocs` 组合表达，而不是复活拷贝。

### 4. 完成证据（交任务票 08）

- 收敛后新增一条测例：同一夹具下，文档列表 / 详情 / 分片预览 / ask 语料四个面**产出一致的可见集合**（不是各自单独断言）。
- 反证：把 `isDocVisible` 的 `eff >= vis` 放宽成恒 true，至少两条既有测例 + 新测例变红。
- 全仓 `grep` 证明不存在第二处 `loadDeptAssignments` 与 `loadDeptNodes` 并列调用（除 `visibility.ts` 自身）。

### 5. 未验证

本裁定的"五处行为等价"来自只读分析，**未实跑**；任务的完成判据要求跑 `apps/api` 全量测试。
