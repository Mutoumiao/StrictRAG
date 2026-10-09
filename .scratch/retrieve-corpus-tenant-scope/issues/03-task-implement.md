# 落：检索语料装载按入口租户收窄

Type: task
Status: resolved
Blocked by: 02

## Question

按工单 02 的裁定实现：

- `CorpusLoader` 入参加 `tenantId`（形状按 02），`retrieve.ts` 两处调用点都传 `input.tenantId`，`corpus.ts` 不再从文档行反推。
- 语料查询按裁定加租户收窄（若裁定加）：`eq(documents.tenantId, tenantId)`。
- 缺租户时的姿态按 02 落地（fail-closed 或与今天一致），并在代码注释里写清**为什么**这样选。
- 其它生产调用点（`apps/api/src/scripts/*` 等）按 01 的清单同步。
- 新增测例（文件头目标/简介简体中文，登记 `apps/api/tests/index.md`）：① 正常单租户 KB 的语料与检索结果与既有断言一致；② **跨租户行不进语料**（夹具放一条异租户文档行）；③ 缺租户姿态（按裁定）；④ **反证**：把租户收窄去掉 → ② 变红。
- **既有测例断言一字不改**（若真变红，按本图 Notes 的红线处理并如实记录）。

**不做**：改 schema / 加约束；动 ES `requireTenantId` 闸；改默认开关。

## Answer

**本票不实施。** 工单 02 裁定「不改语料装载的租户来源」，理由见该票 Answer（既有 fail-closed 测例有意钉住该来源 · 无 PRD 依据 · 两源在可达状态下同值 · ES 硬闸取的入口租户与装载面反推值本非同一变量）。

因此：**0 处源码改动、0 条新增测例、0 处既有断言改动**。核实过程中挖出的真问题（ask 租户两源）**不由本票承接** —— 它须先做一次产品 / 契约裁定（可能须 ADR），已记入 `docs/module-status/api.md` 技术债与雾清单新簇 40。
