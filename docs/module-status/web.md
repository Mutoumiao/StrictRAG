# @strict-rag/web · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/web` |
| 端口 | 3005 |
| 成熟度 | **可演示**（S2 用户端薄壳） |
| 默认依赖模式 | 鉴权 = 临时双 JWT（经 api）· `NEXT_PUBLIC_API_BASE_URL` 默认 `http://127.0.0.1:4000` · 问答 = AI SDK UI Message Stream · rewrite = **服务端强制关**（本包无开关控件）· 知识库 = 手工填写 id |
| 关联模块 | ask 流 / 会话 / 反馈提交：`api`；类型：`contracts`；样式 / 组件：`ui` |
| 最近更新 | 2026-08-28（消费余量：档位 UI、无库空态、建议动作主按钮、429 配额文案、反馈报错/缺文档） |
| Spec | `.trellis/spec/web/frontend/` |
| PRD | `prds/00-product/05-frontend-ia.md` · ask 流相关 API |

## 一句话状态

Next.js 用户端：**登录 + 单轮问答（AI SDK 流式输出）+ 会话列表 / 历史回放 + B13 答后反馈（赞/踩/报错/缺文档）+ 档位下拉 + 无库空态 + 拒答主按钮 + 429 配额文案** 已接通；知识库仍可手填 id（**不是**「只列成员库」切换器），没有完整的产品信息架构（IA），**没有**连续追问 / rewrite。包内配有 Vitest / RTL **P0 红线测试**（R1–R4 / R10；**不是** E2E、**不是** L1 黄金集评测）。

---

## 已具备能力

### 鉴权外壳
- 登录页、客户端 session、`WebAuthGuard`（`src/components/auth-guard.tsx`）
- 登录调用 `POST /api/v1/auth/web/dev-login`（`auth/api.ts` → `webDevLogin`）；`GET /api/v1/auth/me`（`fetchAuthMe`）读当前身份
- 编排层 `auth/services.ts`：`loginWithDev`（调 api → 写 session → `mapBizError`）/ `logoutLocal`（仅清本地）
- 登出（仅清除本地 session，无服务端吊销）
- 存储 key **仅** `strict-rag:web:client-session`（与 admin 端隔离；有测试覆盖）；写/清时 dispatch 会话变更事件 `strict-rag-web-client-session-changed`（`sessionChangedEventName`）

### 问答 UI（S2-#8）
- 选择知识库（手填 / 记忆 `strict-rag:web:last-kb-id`）→ 提问；可见库列表为空时阻断提问并提示「找管理员开通成员」（`ask-panel` EmptyKbCard · `tests/ask/empty-kb.test.tsx`）；列表失败仍可粘贴 uuid
- 问答档位：`getAskModes` → `GET /api/v1/knowledge-bases/:kbId/ask-modes` 读 `allowedModes`/`defaultMode`，提问传 `options.mode`（`tests/ask/ask-mode.test.tsx`）；**不**读 settings、**不**展示 τ
- 流式输出：`@ai-sdk/react` 的 `useChat` + `DefaultChatTransport`；服务端使用 AI SDK UI Message Stream 协议
- 进度展示：`data-status`（瞬时状态）；终态：`data-ask-final` 经 `AskResponseSchema.safeParse` 校验通过后，才进入 answered / abstained 状态；**不**手写 SSE 分帧逻辑
- 三种结果态：`answered`（已回答）/ `abstained`（已拒答）/ 错误；引用列表仅在 answered 且非闲聊（chitchat）路径下展示；点击引用走 `getAskAudit` → `GET /api/v1/ask/:requestId` 展示当时 snapshot（preview 截断），**不是** `chunk.view` 现网全文（`ask-panel.tsx` CitationBlock · `tests/ask/citation-chunk-detail.test.tsx`）
- 空库 `reason=kb_not_ready`：走拒答 `Alert variant="abstain"`（展示 `userMessage`），**不**进系统错误卡（`tests/ask/abstain-alert.test.tsx` · `tests/ask/stream-ready-no-final.test.ts`）
- 拒答建议动作：`suggestedActions` 出主按钮（首项 default）；换问法回填 `lastQuestion`、稍后重试走 `onRetry`、缺文档提交 `missing_doc`、联系管理员给提示（`tests/ask/suggested-actions.test.tsx`）
- 配额触顶：流式 fetch 解析 429 限流码 → 错误卡「提问次数已达上限」，**不**装 answered（`tests/ask/quota-429.test.tsx`）
- 拒答 / 错误时的"重试"：基于 `lastQuestion` 实现（提交后清空输入框不会导致重试按钮失效）
- **流结束但无 final 的兜底**：`useChat` 的 `status==='ready'` 且仍处于 `loading` 时，报错"流式响应未包含有效终态"（`use-knowledge-ask.ts`；有回归测试）

### 会话薄壳（S2-#9）
- 会话列表、新建、切换、历史消息回放
- 历史消息**仅用于展示**，不作为引用证据（citation evidence）
- 支持以 `sessionId=null` 发起单轮问答；若 `data-ask-final` 带回了 `sessionId`，UI 会将其回绑为当前活跃会话（下一轮提问可能已挂在该会话下）

### 工程
- 分层：传输 `lib/http.ts` · 身份 `auth/api.ts` · 业务 `src/api/{ask,sessions,feedback}.ts` · hook `hooks/use-knowledge-ask.ts`
- 401 自动刷新重试（两条路径，**均无单测**）：`lib/http.ts`（Bearer 注入 + 单飞 `ensureRefresh`，失败清 session）+ `api/ask.ts` transport 的 `fetch` 包装（401 → `refreshAccessToken` 重试）
- 类型：`@strict-rag/contracts`
- 样式：Tailwind v4（`postcss.config.mjs`；`src/app/globals.css` 引入 ui 主题并配置 `@source`）；`ask-panel` / 登录页使用 Button · Input · Label · Textarea · Card · Badge · Alert（含 `variant="abstain"`）等原子组件；**没有**大面积用 `style={{}}` 写布局 / 色板
- 构建：`next build --webpack`；`next.config` 配置 `transpilePackages` + webpack `extensionAlias`
- 依赖：`ai` · `@ai-sdk/react`（版本由 catalog 统一管理）
- **B13**：`FeedbackBar`（`ask-panel.tsx`）在 answered/abstained 且有 `requestId` 时展示 有帮助/无帮助/报错/缺文档 → `src/api/feedback.ts` → `POST /api/v1/ask/{requestId}/feedback`（`tests/ask/feedback-category.test.tsx`）
- **B11**：可选文档类型输入（逗号分隔）→ `parseScopeDocTypesInput` / `buildAskRequestBody` → `createAskTransport.getScope` → ask 顶层 `scope.docTypes`；空=不收窄（ADR-050）；**非**强制选类型、**非** GET settings 字典
- **单元 / 组件测试**（Vitest + jsdom + RTL）：`vitest.config.ts` · `src/test/{setup,test-utils}` · 测例在 `tests/<能力>/`（清单 `apps/web/tests/index.md`）；HOW：`.trellis/spec/guides/testing.md`
  - ask final 工厂来自 **`@strict-rag/contracts/testing`**（`src/test/fixtures/ask.ts` 只做 re-export）
  - P0 挂账（`docs/testing/p0-redlines.md`）：**R1** ready 状态但无 final · **R2** 拒答 UI · **R3** mapBizError · **R4** clear / 坏 JSON / 无 token 时返回 null（**不是** expires 产品闸门）· **R10** 同一工厂
  - 其它：`sessions.services`（失败 / 部分失败场景）· lastQuestion 重试 · **`tests/ask/scope-top-level.test.ts`**（B11 parse/body）· hook `getScope` 接线
  - **没有**登录页测试、**没有** Guard 测试、**没有** E2E、**没有** `lib/http` refresh 测试、**没有**客户端 expires 自动失效逻辑

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 产品级 IA / 多路由 | 基本是单页应用；不是完整的用户门户 |
| rewrite / 连续追问 | **未开启**；不得对外承诺 |
| 反馈列表 / 运营处理 | **提交 UI 已有**（B13 FeedbackBar）；队列处理在 admin |
| 分片预览全文 | 引用点回是 **当时快照 preview**；现网 `chunk.view` 全文在 admin，web **无** 分片运营页 |
| 按 `requestId` 断线重拉 | 工单明确不做；`getAskAudit` 不是 AskResponse 重放 |
| 类型字典下拉 / 强制选类型 | B11 刻意不做；依赖 `kb.config.write` 的 GET settings 字典 |
| 知识库发现 / 切换器 | 没有「只列成员库」的产品切换器，仍是 datalist + 可粘贴 uuid（工单明确不做） |
| 生产视觉 / product.pen **像素级**定稿 | Soft Bento token + ui 原子组件已接入；**并非**对 product.pen 的全屏像素还原 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| 知识库手填 id | 演示门槛高、易用性差 | 依赖运营 / 库管人员告知 id |
| Soft Bento / product.pen 未做像素级对齐 | 观感不是最终定稿 | 色板与原子组件在 `packages/ui`；本包只做组合 |
| 会话 / 错误态体验简陋 | 空态 / 错态的规格写在文档里，实现尚未全铺 | 见功能地图 §4.16；RTL 测试只测行为不测像素 |
| 无 E2E、无 http refresh 测试、无 Guard 测试、无 expires 读取闸门 | 跨页跳转 / 401 / token 过期场景靠手测或 API 验证 | P0 清单见 `docs/testing/p0-redlines.md`；expires 客户端闸门挂账在总 backlog **DEC-1**（待产品确认） |

---

## 证据

| 类型 | 指针 |
|------|------|
| 首页 / 登录 | `src/app/page.tsx` · `src/app/login/page.tsx` |
| 鉴权 | `src/components/auth-guard.tsx` · `src/auth/api.ts` · `client-session.ts` |
| 问答面板 | `src/components/ask-panel.tsx`（档位 · 无库空态 · 建议主按钮 · 配额 · 反馈类别 · B11 文档类型可选） |
| ask 流 | `src/hooks/use-knowledge-ask.ts`（含 ready 无 final 兜底 + getScope + getMode）· `src/api/ask.ts`（`parseScopeDocTypesInput` / `buildAskRequestBody` / `getAskAudit` / `getAskModes` / `throwIfAskFailResponse`）· `ask-panel.tsx`（`lastQuestion` · CitationBlock） |
| 引用点回 | `src/api/ask.ts` `getAskAudit` · `ask-panel.tsx` CitationBlock · `tests/ask/citation-chunk-detail.test.tsx` |
| 消费余量测 | `tests/ask/ask-mode.test.tsx` · `empty-kb.test.tsx` · `suggested-actions.test.tsx` · `quota-429.test.tsx` · `feedback-category.test.tsx` |
| B11 测 | `tests/ask/scope-top-level.test.ts` · `tests/ask/stream-ready-no-final.test.ts` getScope / getMode |
| 会话 / 反馈 | `src/api/sessions.ts` · `src/services/sessions.services.ts` · `src/api/feedback.ts` · `ask-panel` FeedbackBar |
| 前端测试 | `vitest.config.ts` · `src/test/` · `tests/ask/stream-ready-no-final.test.ts`（R1 · kb_not_ready final）· `tests/ask/abstain-alert.test.tsx`（R2 · kb_not_ready 拒答卡）· `tests/auth/client-session.test.ts`（R4）· `tests/error-map/map-biz-error.test.ts`（R3）· `tests/sessions/session-shell.test.ts` · fixtures → `@strict-rag/contracts/testing` |
| P0 清单 | `docs/testing/p0-redlines.md`（本包 R1–R4 · 协作 R10） |
| 命令 | `pnpm --filter @strict-rag/web test`（`package.json` → `vitest run`） |
| 传输层 | `src/lib/http.ts`（**尚无**单测） |
| 样式入口 | `apps/web/src/app/globals.css` · `postcss.config.mjs` · `package.json`（tailwind · `build --webpack`） |
| Task（辅证 · 归档） | `08-05-p2-web-ask-ui` · `08-05-p2-sessions-shell` · `08-06-frontend-tailwind-shadcn` · `08-11-b13-feedback-ui` · `08-13-b11-doc-type-scope-ui` |
