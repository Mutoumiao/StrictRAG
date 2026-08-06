# @strict-rag/contracts · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/contracts` |
| 成熟度 | **可联调**（支撑 P0/P1 入库 + S2 ask / 会话 / 反馈 / 成员 + **B1 分片**） |
| 默认依赖模式 | 纯库；无运行时开关 |
| 关联模块 | 被 `api` · `worker` · `web` · `admin` 消费；错误码与信封全仓唯一源 |
| 最近更新 | 2026-08-06 |
| Spec | `.trellis/spec/contracts/` |
| PRD | `prds/05-api` · 各域 contract 与 PRD 短名对齐 |

## 一句话

共享 **Zod 契约 + 业务码 + 队列名 + ApiResponse 信封**：P1 入库、B1 分片只读与 S2 ask/会话/反馈/成员路径已有契约；**不是**全产品域完整 OpenAPI 覆盖。

---

## 已具备能力

### 公共
- `BizCode`：对外 `error.code` 短名（与 PRD §4 对齐）
- `ApiResponse` 等响应信封（`common/response`）

### 系统 / 鉴权 / 异步
- health / ready 响应 schema（`system/health.contract`）
- session 相关 auth 契约（`auth/session.contract`）
- 队列名 SSOT：`QUEUE_NAMES.PROBE` · `INGEST`（`async/queues`；BullMQ 禁用 `:`）

### 入库
- 文档 body + **列表/详情/审批/扫描等成功 data**（`ingest/document.contract`）
- 分片 list query/item/response + detail（`ingest/chunk.contract`；list **无** body 字段）

### 问答（S2）
- ask 请求/响应 · reason · 流 `data-status` 形状（`ask/ask.contract` · `ask/reason`；`AskResponse` ≡ 同步 JSON / `data-ask-final`）
- 会话壳 + 列表包装 + **`SessionListQuerySchema`**（`ask/session.contract`；api list route 已绑）
- 反馈 + 队列列表包装 + **`FeedbackQueueQuerySchema`**（`ask/feedback.contract`；api queue route 已绑）
- KB 成员 + 邀请/移除响应（`ask/member.contract`）
- AuthMe / TokenPair（`auth/session.contract`）
- 契约单测：`ask/ask.contract.test.ts`

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 全量运营域契约 | 数据面板 / 模型供应商 UI / 部门树等未建独立 contract 域 |
| 生产 OpenAPI 生成与发布 | 以 Zod 源码为准；无独立 swagger 发布流水线声明 |
| 版本化兼容策略文档化 | 随能力增量扩；破坏变更须改 PRD 后动契约 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| 域文件随 feature 增长 | 易漏测 | 新契约宜同域 `*.contract.test.ts` |
| `SESSION_DISABLED` 与 rewrite 语义别名 | 易误用拒多会话 | 码注释已约束用途 |
| `AskSse*` 命名历史前缀 | 与 AI SDK data parts 易混读 | 语义已是 data-status；PRD §2.7 仍写旧 event 名（WHAT 债，非本包实现） |
| 无独立 package 级集成测 | 主要靠 api 路由测 + 本包 unit | 可接受于当前阶段 |

---

## 证据

| 类型 | 指针 |
|------|------|
| 入口导出 | `packages/contracts/src/index.ts` |
| 业务码 | `packages/contracts/src/common/biz-code.ts` |
| 队列 | `packages/contracts/src/async/queues.ts` |
| ask 域 | `packages/contracts/src/ask/*` |
| 入库 | `packages/contracts/src/ingest/document.contract.ts` |
| 分片 | `packages/contracts/src/ingest/chunk.contract.ts` · `chunk.contract.test.ts` |
| 单测 | `packages/contracts/src/ask/ask.contract.test.ts` · `ingest/chunk.contract.test.ts` |
| Task（归档） | `.trellis/tasks/archive/2026-08/08-05-p2-contracts-schema/` · P0/P1 archive |
