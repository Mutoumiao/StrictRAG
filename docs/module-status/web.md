# @strict-rag/web · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `apps/web` |
| 端口 | 3005 |
| 成熟度 | **可演示**（S2 用户端薄壳） |
| 默认依赖模式 | 鉴权=临时双 JWT（经 api）· 问答默认 AI SDK UI Message Stream · rewrite=关（服务端强制）· KB=手填 id |
| 关联模块 | ask 流/会话：`api`；类型：`contracts`；样式/组件：`ui` |
| 最近更新 | 2026-08-07 |
| Spec | `.trellis/spec/web/frontend/` |
| PRD | `prds/00-product/05-frontend-ia.md` · ask 流相关 API |

## 一句话

Next.js 用户端：**登录 + 单轮问答（AI SDK 流）+ 会话列表/历史回放** 已接；KB 手填 id，无完整产品 IA，**无**连续追问/rewrite，**无**反馈提交 UI。包内有 Vitest/RTL **P0 红线测**（R1–R4/R10；**非** E2E、**非** L1 黄金集）。

---

## 已具备能力

### 鉴权壳
- 登录页 · 客户端 session · `WebAuthGuard`（`src/components/auth-guard.tsx`）
- 登出（本地清 session，无服务端 revoke）
- 存储 key **仅** `strict-rag:web:client-session`（与 admin 隔离；有测）

### 问答 UI（S2-#8）
- 选 KB（手填/记忆 `strict-rag:web:last-kb-id`）→ 提问
- 流式：`@ai-sdk/react` `useChat` + `DefaultChatTransport`；服务端 AI SDK UI Message Stream
- 进度：`data-status`（transient）；终态：`data-ask-final` 经 `AskResponseSchema.safeParse` 后才进 answered/abstained；**不**手写 SSE 分帧
- 三态：`answered` / `abstained` / 错误；引用仅 answered 非 chitchat 路径
- 拒答/错误「重试」：`lastQuestion`（提交后清空输入框不导致重试死按钮）
- **流结束无 final**：`useChat` `status==='ready'` 且仍 `loading` → error「流式响应未包含有效终态」（`use-knowledge-ask.ts`；有回归测）

### 会话薄壳（S2-#9）
- 会话列表 · 新建 · 切换 · 历史消息回放
- 历史 **仅展示**，不当 citation 证据
- 可 `sessionId=null` 发起单轮；若 `data-ask-final` 带回 `sessionId`，UI 会回绑 active 会话（下一轮可能已挂会话）

### 工程
- 分层：传输 `lib/http.ts` · 身份 `auth/api.ts` · 业务 `src/api/{ask,sessions,feedback}.ts` · hook `hooks/use-knowledge-ask.ts`
- 类型：`@strict-rag/contracts`
- 样式：Tailwind v4（`postcss.config.mjs` · `src/app/globals.css` 引 ui theme + `@source`）；`ask-panel` / 登录用 Button · Input · Label · Textarea · Card · Badge · Alert（含 `variant="abstain"`）等；**无**大面积布局/色板 `style={{}}`
- 构建：`next build --webpack`；`next.config` 含 `transpilePackages` + webpack `extensionAlias`
- 依赖：`ai` · `@ai-sdk/react`（catalog）
- `src/api/feedback.ts` 仅 HTTP 封装；**无**反馈 UI
- **单元/组件测**（Vitest + jsdom + RTL）：`vitest.config.ts` · `src/test/{setup,test-utils}` · 同域 `*.test.ts(x)`  
  - ask final 工厂：**`@strict-rag/contracts/testing`**（`src/test/fixtures/ask.ts` 仅 re-export）  
  - P0 挂账（`docs/testing/p0-redlines.md`）：**R1** ready 无 final · **R2** abstain UI · **R3** mapBizError · **R4** clear/坏 JSON/无 token → null（**非** expires 产品闸）· **R10** 同工厂  
  - 其它：`sessions.services`（失败/部分失败）· lastQuestion 重试  
  - **无** 登录页测 · **无** Guard 测 · **无** E2E · **无** `lib/http` refresh 测 · **无** 客户端 expires 自动失效
---

## 明确未做 / 边界

| 项 | 说明 |
|----|------|
| 产品级 IA / 多路由 | 基本单页；非完整用户门户 |
| rewrite / 连续追问 | **未开**；不得对外承诺 |
| 反馈控件 | api 有 feedback API；**本包无**提交/列表 UI |
| 分片预览全文、doc_type scope UI | backlog B1/B11 |
| 知识库发现/切换器 | 无 KB 浏览，仅手填 id |
| 生产视觉 / pen **像素**定稿 | Soft Bento token + ui 原子已接；**非** product.pen 全屏像素还原 |

---

## 技术债

| 债 | 影响 | 备注 |
|----|------|------|
| KB 手填 id | 演示门槛、易用性差 | 依赖运营/库管告知 id |
| Soft Bento / pen 未像素对齐 | 观感非定稿 | 色板与原子在 `packages/ui`；本包只组合 |
| 会话/错误态体验简陋 | 空/错态规格在文档，实现未全铺 | 功能地图 §4.16；RTL 测行为不测像素 |
| 无 E2E · 无 http refresh 测 · 无 Guard 测 · 无 expires 读闸 | 跨页/401/过期靠手测或 API | P0 见 `docs/testing/p0-redlines.md`；expires 客户端闸 → 总 backlog **DEC-1**（待产品确认） |

---

## 证据

| 类型 | 指针 |
|------|------|
| 首页 / 登录 | `src/app/page.tsx` · `src/app/login/page.tsx` |
| 鉴权 | `src/components/auth-guard.tsx` · `src/auth/api.ts` · `client-session.ts` |
| 问答面板 | `src/components/ask-panel.tsx` |
| ask 流 | `src/hooks/use-knowledge-ask.ts`（含 ready 无 final 兜底）· `src/api/ask.ts` · `ask-panel.tsx`（`lastQuestion`） |
| 会话 / 反馈客户端 | `src/api/sessions.ts` · `src/services/sessions.services.ts` · `src/api/feedback.ts`（无 UI） |
| 前端测 | `vitest.config.ts` · `src/test/` · `hooks/use-knowledge-ask.test.ts`（R1）· `components/ask-panel.test.tsx`（R2）· `auth/client-session.test.ts`（R4）· `lib/map-biz-error.test.ts`（R3）· `services/sessions.services.test.ts` · fixtures → `@strict-rag/contracts/testing` |
| P0 清单 | `docs/testing/p0-redlines.md`（本包 R1–R4 · 协作 R10） |
| 命令 | `pnpm --filter @strict-rag/web test`（`package.json` → `vitest run`） |
| 传输 | `src/lib/http.ts`（**尚无**单测） |
| 样式入口 | `apps/web/src/app/globals.css` · `postcss.config.mjs` · `package.json`（tailwind · `build --webpack`） |
| Task（归档） | `.trellis/tasks/archive/2026-08/08-05-p2-web-ask-ui/` · `08-05-p2-sessions-shell/` · `08-06-frontend-tailwind-shadcn/` |
| 签字（归档） | `.trellis/tasks/archive/2026-08/08-05-phase-2-ask/sign-off.md` |
