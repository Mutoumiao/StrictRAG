# @strict-rag/web · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/web` |
| 端口 | 3005 |
| 成熟度 | **可演示**（S2 用户端薄壳） |
| 默认依赖模式 | 鉴权=临时双 JWT（经 api）· 问答默认 AI SDK UI Message Stream · rewrite=关（服务端强制）· KB=手填 id |
| 关联模块 | ask 流/会话：`api`；类型：`contracts`；theme：`ui` |
| 最近更新 | 2026-08-06 |
| Spec | `.trellis/spec/web/frontend/` |
| PRD | `prds/00-product/05-frontend-ia.md` · ask 流相关 API |

## 一句话

Next.js 用户端：**登录 + 单轮问答（AI SDK 流）+ 会话列表/历史回放** 已接；KB 手填 id，无完整产品 IA，**无**连续追问/rewrite，**无**反馈提交 UI。

---

## 已具备能力

### 鉴权壳
- 登录页 · 客户端 session · `WebAuthGuard`（`src/components/auth-guard.tsx`）
- 登出（本地清 session，无服务端 revoke）

### 问答 UI（S2-#8）
- 选 KB（手填/记忆 `strict-rag:web:last-kb-id`）→ 提问
- 流式：`@ai-sdk/react` `useChat` + `DefaultChatTransport`；服务端 AI SDK UI Message Stream
- 进度：`data-status`（transient）；终态：`data-ask-final` 经 `AskResponseSchema.safeParse` 后才进 answered/abstained；**不**手写 SSE 分帧
- 三态：`answered` / `abstained` / 错误；引用仅 answered 非 chitchat 路径
- 拒答/错误「重试」：`lastQuestion`（提交后清空输入框不导致重试死按钮）

### 会话薄壳（S2-#9）
- 会话列表 · 新建 · 切换 · 历史消息回放
- 历史 **仅展示**，不当 citation 证据
- 可 `sessionId=null` 发起单轮；若 `data-ask-final` 带回 `sessionId`，UI 会回绑 active 会话（下一轮可能已挂会话）

### 工程
- 分层：传输 `lib/http.ts` · 身份 `auth/api.ts` · 业务 `src/api/{ask,sessions,feedback}.ts` · hook `hooks/use-knowledge-ask.ts`
- 走 `@strict-rag/contracts` 类型 · 仅引入 `@strict-rag/ui/theme.css`（无组件库页面）
- 依赖：`ai` · `@ai-sdk/react`（catalog）
- `src/api/feedback.ts` 仅 HTTP 封装；**无**反馈 UI

---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 产品级 IA / 多路由 | 基本单页；非完整用户门户 |
| rewrite / 连续追问 | **未开**；不得对外承诺 |
| 反馈控件 | api 有 feedback API；**本包无**提交/列表 UI |
| 分片预览全文、doc_type scope UI | backlog B1/B11 |
| 知识库发现/切换器 | 无 KB 浏览，仅手填 id |
| 生产视觉定稿落地 | 线稿在 pen；本包为功能薄壳 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| KB 手填 id | 演示门槛、易用性差 | 依赖运营/库管告知 id |
| UI 与 pen Soft Bento 未对齐 | 观感非定稿 | 设计见交付控制台 §0 |
| 会话/错误态体验简陋 | 空/错态规格在文档，实现未全铺 | 功能地图 §4.16 |
| 无 E2E / 无 hook 单测 | 主要靠 api 单测 + 手测 | 旧手写 SSE 单测已随协议删除 |
| 流结束无 final 时可能停 loading | 边角 | 服务端 catch 已写 final；客户端未兜底 ready 无 final |

---

## 证据

| 类型 | 指针 |
|------|------|
| 首页 / 登录 | `src/app/page.tsx` · `src/app/login/page.tsx` |
| 鉴权 | `src/components/auth-guard.tsx` · `src/auth/api.ts` · `client-session.ts` |
| 问答面板 | `src/components/ask-panel.tsx` |
| ask 流 | `src/hooks/use-knowledge-ask.ts` · `src/api/ask.ts`（transport） · `ask-panel.tsx`（`lastQuestion`） |
| 会话 / 反馈客户端 | `src/api/sessions.ts` · `src/api/feedback.ts`（无 UI） |
| 传输 | `src/lib/http.ts` |
| Task（归档） | `.trellis/tasks/archive/2026-08/08-05-p2-web-ask-ui/` · `08-05-p2-sessions-shell/` |
| 签字（归档） | `.trellis/tasks/archive/2026-08/08-05-phase-2-ask/sign-off.md` |
