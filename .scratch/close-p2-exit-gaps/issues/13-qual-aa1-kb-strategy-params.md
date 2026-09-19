# QUAL-AA1：KB 策略参数可保存 + 审计

Type: task
Status: resolved
Blocked by: 02

## Question

剧本 AA1：「KB 策略参数**可保存** + **审计**；旧文档 chunk 边界 / version 不变」。IS：settings 白名单无策略参数；设置页只读展示已实现策略；前图 88 已把分片策略 PATCH 的 diff 落 `kb_settings_audits`（键 `chunkStrategy.<code>.<field>`，复用不新建表）。

请先**判定剩余差什么**才满足 AA1 的 Then，逐条给证据行：

1. 「参数可保存」是否已被 88 覆盖？还是仍缺 settings 白名单 / 上传与 reindex 必选参数面（B12 已落注册表 + complete/reindex 闸）？
2. 「审计」是否已由 88 覆盖？覆盖到哪一层（KB 库启用表 vs 文档级）？
3. 「旧文档 chunk 边界 / version 不变」是否需要**新证据**（现有测例是否已断言旧文档 version 与边界不动）？

然后按判定收口：**若已具备则只补缺失的测**（不得写新实现充数）；**若缺则补最小实现**。

约束：不改 ADR-053 语义；不得让旧文档自动切策略；旧文档版本与快照不变。

## Answer

### 判定：**部分已做，差数据级断言**

逐条核（证据见 [`research/gap-is-a.md`](../research/gap-is-a.md)）：

1. **「参数可保存」——已由前图 88 覆盖**：走 `PATCH …/chunk-strategies` 的 `paramOverrides`（`packages/contracts/src/ingest/chunk-strategy.contract.ts:58-66`）。
2. **「审计」——已由 88 覆盖**：有 diff 才落 `kb_settings_audits`，键 `chunkStrategy.<code>.<field>`（`apps/api/src/routes/chunk-strategies.ts:113-125` · `services/chunk-strategy-catalog.ts:305-323`）。
3. **「旧文档 chunk 边界 / version 不变」——只有代理断言**：既有 `chunk-strategy-audit.test.ts:149-150` 断的是「文档写仓未被调用」，**不是**数据本身未变。

所以本票**不写新实现**，只把第 3 条升为数据级断言。

### 补了什么

新增 `apps/api/tests/kb/chunk-strategy-preserves-docs.test.ts`（3 条），以「文档 + chunk 边界」**数据夹具**为唯一「被改即变红」的对象：

- 夹具：`{ doc: { indexVersion: 3, chunkStrategy, chunkStrategyParams }, chunks: [两段带 ordinal 的 bodyText] }`。
- 文档写仓（`setChunkStrategy` / `patchMeta` / `setIndexVersion` / `markCompletePending`）若被调用会**直接改夹具** → `expect(fixture).toEqual(before)` 变红。即断言是数据级而非「mock 没被调」。
- **正向对照**（防「什么都没做」的假绿）：断言策略行 `paramOverrides` 确已变（512/64）+ 审计确落一条 `paramOverrides` diff。
- 三场景：改参数 / 停用策略 / 无 diff（不落审计）。
- 已登记 `apps/api/tests/index.md`。仅补测，**未**改服务端与契约。

### 反证（确认断言有牙齿）

临时在 `routes/chunk-strategies.ts` 的 PATCH 成功路径插一句 `documentRepo.patchMeta(...)` → 该测例 **3/3 变红** → 已完整还原（`git diff` 无残留，`TEMP-NEGATIVE-CHECK` 搜为 0）。

### 未做

不改 ADR-053 语义；不新增「旧文档自动切策略」；不新增 KB 策略参数白名单（88 已覆盖保存面）。
