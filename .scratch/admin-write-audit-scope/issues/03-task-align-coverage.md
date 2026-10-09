# 落：按口径对齐覆盖面 + 防漂移结构测例 + 反证

Type: task
Status: resolved
Blocked by: 02

## 目标

按工单 02 的裁定改代码、补测例，并留下**可核对**的证据。纪律：**只加严**；`admin_write` 载荷**不得**加请求体 / 字段值 / 密钥；改既有断言必须先有裁定依据。

## 交什么

1. **判定函数**：`shouldAuditAdminWrite`（或替代形状）按裁定改写；口径文本（判据 + 例外表 + 每条依据）写在源码注释里，与实现一致。
2. **防漂移测例**（若裁定引入）：从**真实 app** 枚举 mutating 路由 × 断言；例外表 + 理由；一条「故意漏登记 → 必红」的反证（可用临时改例外表的方式验证，验证后还原）。
3. **路径级测例**：改前漏审 / 改后已审的逐条对照；既有 4 组用例的增补（**每条改动都注明依据**）。
4. **强度分级落地**：裁定判「本图落地」的项才动；判「记债」的写清缺什么才能销账。
5. **反证**：拆掉判据（新规则恒假 / 例外表误吞）→ 若干条测例必红，记录**红了几条、哪几条**，还原后全绿。
6. **门禁**：`pnpm check-types` · `pnpm lint`（零 warning）· 相关包测试（至少 `apps/api`）；`tests/index.md` 登记。

## Answer

### 改动表

| 文件 | 改了什么 |
|---|---|
| `apps/api/src/middleware/admin-write-audit.ts` | 判定从「六条正则**枚举**」改为「**默认全审 + 显式例外**」：新增 `INFRA_PATHS` · `AUDIT_EXCLUSIONS`（7 条例外 = 11 条路由，逐条带 `reason` + `routes`）· `isAuditExcluded`；`shouldAuditAdminWrite` 改为 `MUTATING ∧ ¬infra ∧ ¬excluded`。口径（语义判据 + 为什么只能落在路径上 + 例外逐条理由）写进源码注释。**载荷与中间件本体一字未动**（仍 `{event,method,path,status,durationMs}` + 上下文，无 body / 无字段值）。 |
| `apps/api/tests/obs/admin-write-coverage.test.ts` | **新增**（4 条 it）：从 `createApp().routes` 枚举 → 按 `(method,path)` 去重 → 只留 mutating → ① 全覆盖（每条要么被审、要么被例外逐字声明）② 例外表紧致（每条 `pattern` 在 mutating 集上**恰好**命中其 `routes`，且声明路由真实存在、`reason` 非空）③ 计数快照（39 + 11 = 50）④ 方向一致（命中例外即不审；未在例外表的新写路径默认被审）。 |
| `apps/api/tests/obs/admin-write-audit.test.ts` | **只增补**一条 `it`：15 条新纳入路径逐条断言为 `true`（每条带 PRD 依据注释）。**既有 4 组断言的期望值一字未改**。 |
| `apps/api/tests/index.md` | 新文件登记一行。 |

**新增覆盖 15 条**（R3）：`POST /api/v1/knowledge-bases` · `POST …/documents/:docId/{reindex,scan,supersede}` · `POST …/dedupe-conflicts/:chunkId/resolve` · `DELETE/PATCH /api/v1/documents/:docId` · `PUT …/documents/:docId/acl` · `PUT …/knowledge-bases/:kbId/model-bindings` · `PATCH …/chunk-strategies` · `PATCH /api/v1/feedback/:feedbackId` · `POST/PATCH/DELETE …/gold-questions` · `POST …/eval/runs`。⇒ **审计 39 + 例外 11 = 50**（与工单 01 实测的 50 条、命中 24 / 未命中 26 自洽）。

### 反证（三轮，逐轮红数）

| 轮 | 探针 | 结果 |
|---|---|---|
| a | `shouldAuditAdminWrite` 末行改为恒 `false`（判据空转） | **9 红**（既有文件 6 + 覆盖文件 3）→ 证明新测例不是空转 |
| b | 把 upload-url 例外正则放宽成 `/^\/api\/v1\/knowledge-bases\/[^/]+\/documents\//`（会吞掉 complete / write） | **4 红**（全覆盖 1 + 紧致 1 + 计数 1 + 既有 1）→ 证明「例外写宽了、新路由静默免审」会被抓 |
| c | （探针失败记录）第一次把 complete 正则放宽成 `…/documents/[^/]+\/.*$` —— **16 全绿**：该放宽恰好仍只命中 1 条（其余文档处置路由都在 `/api/v1/documents/…` 前缀下）⇒ 记下「反证探针本身也可能无效」，改用 b | — |

还原后复跑：**16/16 绿**。

### 翻掉的既有断言

**零。** `apps/api/tests/obs/admin-write-audit.test.ts:76-86` 的两条有意断言（`complete` / `sessions` → `false`）因这两条**在例外表里**而继续为真；断言 `childLogger().info` 次数的那 4 处也不受影响。**未放宽任何实现来让测试变绿。**

### 未验证（如实列）

- **真 PG / 真进程**：本图改动是纯路径判定 + 测例，未起真实 api 进程、未连 DB；`createApp()` 枚举在测试里跑过（实测可行）。
- **浏览器**：本图不涉 UI。
- **`app.routes` 的稳定性**：本仓用 `hono@4.13.0`；若将来升 Hono 大版本改变了 `routes` 的形状（今天 = `[basePath,path,method,handler]`，按 handler 展开），新测例会红（这本身是期望行为）。
- **生产日志采集**：`admin_write` 是否被外部平台收集、180 天保留期由谁承接 —— 仓内无证据，**未核**（已记债 R9）。

### 门禁数字

`pnpm check-types --filter @strict-rag/api` 通过（4 tasks）· `pnpm lint --filter @strict-rag/api` 零 warning（4 tasks）· `apps/api` 全量 `pnpm test`：**186 文件 / 1161 通过 + 3 skipped**（较改动前 +1 文件 / +5 用例）· 存货闸从 `apps/api` 目录跑 exit 0。
