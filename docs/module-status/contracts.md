# @strict-rag/contracts · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/contracts` |
| 成熟度 | **可联调**（支撑 P0/P1 入库 + S2 问答 / 会话 / 反馈 / 成员 + B1–B5） |
| 默认依赖模式 | 纯库；无运行时开关 |
| 关联模块 | 被 `api` · `worker` · `web` · `admin` 消费；是全仓错误码与响应信封的唯一来源 |
| 最近更新 | 2026-08-07 |
| Spec | `.trellis/spec/contracts/` |
| PRD | `prds/05-api` · 各域契约与 PRD 短名对齐 |

## 一句话状态

共享的 **Zod 契约 + 业务错误码 + 队列名 + ApiResponse 响应信封**：P1 入库、B1–B5 以及 S2 问答 / 会话 / 反馈 / 成员路径均已有契约；另提供**测试专用**的 `@strict-rag/contracts/testing` 子路径（ask final 工厂，**不是**生产 API）。**不是**覆盖全产品域的完整 OpenAPI。

---

## 已具备能力

### 公共
- `BizCode`：对外暴露的 `error.code` 短名（与 PRD §4 对齐）
- `ApiResponse` 等响应信封（`common/response`）

### 系统 / 鉴权 / 异步
- health / ready 响应 schema（`system/health.contract`）
- session 相关鉴权契约（`auth/session.contract`）
- 队列名 SSOT：`QUEUE_NAMES.PROBE` · `INGEST`（`async/queues`；因 BullMQ 禁用 `:` 字符做了规避）

### 入库
- 文档 body 及**列表 / 详情 / 审批 / 扫描等成功响应的 data 形状**（`ingest/document.contract`）
- 分片 list query / item / response + detail（`ingest/chunk.contract`；list 响应**不含** body 字段）

### 问答（S2）
- ask 请求 / 响应、拒答原因（reason）、流式 `data-status` 形状（`ask/ask.contract` · `ask/reason`；`AskResponse` 同时等价于同步 JSON 响应与流式 `data-ask-final`）
- 会话外壳 + 列表包装 + **`SessionListQuerySchema`**（`ask/session.contract`；api 的 list 路由已绑定）
- 反馈 + 队列列表包装 + **`FeedbackQueueQuerySchema`**（`ask/feedback.contract`；api 的 queue 路由已绑定）
- KB 成员 + 邀请 / 移除响应（`ask/member.contract`）
- AuthMe / TokenPair（`auth/session.contract`）
- 契约单测：`ask/ask.contract.test.ts`

### 测试辅助（仅供 Vitest 消费）
- 导出子路径 **`@strict-rag/contracts/testing`** → `src/testing.ts`（**未**挂在主 `index.ts` 上）
- `makeAnsweredFinal` / `makeAbstainedFinal`（`ask/fixtures.ts`）；**R10**：`ask/fixtures.test.ts` 对 `AskResponseSchema.safeParse` 做校验
- 消费方：web 的 `src/test/fixtures/ask.ts` 做 re-export；清单见 `docs/testing/p0-redlines.md`

### 知识库设置（B2）
- `KbSettings` / `PatchKbSettingsBodySchema`（strict 白名单 + modes 唯一性约束）（`kb/kb-settings.contract`）
- `qualitySnapshot` · `sessionRewrite` 的锁定形状；禁止 τ / rewrite 相关写键

### 模型网关（B3）
- Provider / Create / Patch / Presets / Binding / Catalog / ModelRef helpers（`system/model-gateway.contract`）
- GET 响应形状含 `hasApiKey` 标志；**不含** apiKey 字段；purpose 类型闸门 helper

### 平台用户 / 角色（B4）
- User / Role / Create / Patch / Assign roles / Put permissions / PermissionCatalog（`system/platform-users-roles.contract`）

### 部门组织骨架（B5）
- Department / Create / Patch / TreeNode / UserDepartmentAssignment / PutUserDepartments / UserDepartmentsView（`system/departments.contract`）
- **不含** password 字段（strict 模式）；role code 使用 snake_case 命名

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 全量运营域契约 | 数据面板 / 跨部门授权 / KB 级模型绑定等尚未建立或未完成 |
| 生产 OpenAPI 生成与发布 | 以 Zod 源码为准；没有独立的 swagger 发布流水线声明 |
| 版本化兼容策略文档化 | 契约随能力增量扩展；破坏性变更必须先改 PRD 再动契约 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| 域文件随功能增长 | 容易漏测试 | 新契约建议配同域的 `*.contract.test.ts` |
| `SESSION_DISABLED` 与 rewrite 语义别名 | 容易被误用为"拒绝多会话" | 代码注释已约束用途 |
| `AskSse*` 命名是历史前缀 | 容易与 AI SDK 的 data parts 混淆理解 | 语义上已是 data-status；PRD §2.7 仍写旧的 event 名（属 WHAT 层文档债，不是本包的实现问题） |
| 无独立的包级集成测试 | 主要靠 api 路由测试 + 本包单元测试 | 当前阶段可接受 |

---

## 证据

| 类型 | 指针 |
|------|------|
| 入口导出 | `packages/contracts/src/index.ts` · 测试导出 `package.json` exports `./testing` → `src/testing.ts` |
| ask fixtures | `src/ask/fixtures.ts` · `fixtures.test.ts`（R10） |
| 业务错误码 | `packages/contracts/src/common/biz-code.ts` |
| 队列 | `packages/contracts/src/async/queues.ts` |
| ask 域 | `packages/contracts/src/ask/*` |
| 入库 | `packages/contracts/src/ingest/document.contract.ts` |
| 分片 | `packages/contracts/src/ingest/chunk.contract.ts` · `chunk.contract.test.ts` |
| 知识库设置 | `packages/contracts/src/kb/kb-settings.contract.ts` · `kb-settings.contract.test.ts` |
| 单测 | `packages/contracts/src/ask/ask.contract.test.ts` · `ask/fixtures.test.ts` · `ingest/chunk.contract.test.ts` · `kb/kb-settings.contract.test.ts` · 其它 `system/*` 域测试 |
| P0 清单 | `docs/testing/p0-redlines.md`（本包协作 R10） |
| Task（已归档） | `.trellis/tasks/archive/2026-08/08-05-p2-contracts-schema/` · P0/P1 archive |
