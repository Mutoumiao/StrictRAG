# QUAL-TENANT-Q：无 tenantId 的 ES builder 必须失败

Type: task
Status: open
Blocked by: 02

## Question

剧本 O4：「无 `tenantId` 的 query / bulk builder 必须失败」。IS：ES query / bulk builder 均无 `tenantId` 强制字段，现仅 `kbId` filter（O1 测的是 `kbId`，不是本 ID）。

把 `tenantId` 变成 builder 的**必填硬约束**：

- 共享索引与「多租户独立索引」两种布局都不例外；缺 `tenantId` 时**构查询即失败**（不是静默少过滤、不是回退全租户、不是补默认租户）。
- 范围：`apps/api` 检索 / 预览侧 + `apps/worker` bulk 侧，**含 mock ES 适配层路径**（凡走到 ES 查询构造的地方都要覆盖）。
- 契约：仅当需要新错误码 / 类型时才动 `packages/contracts`；错误码取 PRD 短名。

补测：无 `tenantId` 必须失败（query 与 bulk 各一条），有 `tenantId` 行为**逐位不变**（既有 O1 `kbId` 测不得被改写）。**禁止放宽既有 `kbId` 闸。**

## Answer

<!-- 解析时写 -->
