# web · 质量指南

## 产品语义（ask UI）

| 规则 | 说明 |
|------|------|
| 拒答可见 | 失败 reason / userMessage 映射用户文案；禁止伪装成成功答案 |
| citations | 仅展示服务端返回的合法 id；不可前端「补编」引用；点回走 `GET /ask/:requestId` **当时快照**（preview 截断），禁止当 `chunk.view` 现网全文 |
| options | 只传白名单：stream / debug / mode / locale；`mode` 来自 `GET …/ask-modes` 的 allowedModes（禁止直改 τ / retrieveK） |
| 无可用库 | 列表成功且为空 → 阻断提问，文案「找管理员开通成员」；列表失败仍可粘贴 uuid（选择器半接线不在此改） |
| 建议动作 | 拒答 `suggestedActions` 出主按钮（首项 default）；按 type 换问法 / 重试 / 缺文档 / 联系管理员；禁止只做无动作列表 |
| 配额 | HTTP 429 / `RATE_LIMITED` → 配额文案；禁止装 answered |
| scope | 产品检索 scope（如 `docTypes`）放在 **请求顶层** `scope`，**禁止**塞进 `options`（ADR-050） |
| 流式终态 | **只信 `data-ask-final`**（`AskResponseSchema.safeParse` 通过后才更新 answered/abstained） |
| 流式进度 | `data-status`（transient）仅驱动 loading phase；`phase=error` 可进错误态。**空库 `kb_not_ready` 是业务拒答**，走 `data-ask-final` abstained，禁止当系统错误卡 |
| 流结束无 final | `useChat` `status==='ready'` 且 `view` 仍为 `loading` → **必须**落 error（禁止永卡 loading / 提问 disabled） |
| 重试 | 提交后会清空输入框 → **必须**保留 `lastQuestion`（或等价）；`onRetry` **禁止**只读已空的 `question` |
| 禁止 | 自写 SSE 分帧；用 text-delta / 中间事件覆盖终态答案 |
| 质量面板 | 禁止 UI 暴露 tauClaim 等调参给普通用户 |
| rewrite | P2 强制关；debug 若展示须 `rewriteUsed=false` |
| 反馈（B13） | 仅提交本轮 `requestId` 的 rating/category/comment；类别含报错 `wrong_answer` / 缺文档 `missing_doc`；**禁止**把用户评论当 citation/evidence 回灌 ask |
| 反馈 API | `src/api/feedback.ts` → `POST /api/v1/ask/:requestId/feedback`；鉴权/成员以 **API** 为准 |

## 技术约定

- `cn` / 组件：**子路径优先** `@strict-rag/ui/lib/utils` · `@strict-rag/ui/components/ui/*`（契约见 [ui · component-guidelines](../../ui/frontend/component-guidelines.md)）  
- 三态视觉：answered → `success`；**abstained → `abstain`**；error → `destructive`（拒答 ≠ 系统红）  
- 入口：`globals.css` import ui theme + `@source`；`layout` 只引 globals  
- 构建：`next build --webpack` + `extensionAlias`  
- ESLint：`next-js` 配置  
- 与 admin **拆包**：勿把管理页塞进 web  
- 类型：`AskRequest` / `AskResponse` / BizCode 来自 `@strict-rag/contracts`  
- 流客户端：`@ai-sdk/react` `useChat` + `ai` `DefaultChatTransport`（`src/api/ask.ts` · `hooks/use-knowledge-ask.ts`）  
- **env / 密钥**：浏览器包 **仅** `NEXT_PUBLIC_*`（经 `env.client.ts`）；**禁止** `DATABASE_URL`、JWT secret、Provider Key、ES/Mongo 凭据进 web；API base 只经 `env.client` + `lib/http` / transport  
- **依赖**：不得 import `@strict-rag/db`；不得浏览器直连 ES/PG（见 [monorepo-boundaries](../../guides/monorepo-boundaries.md)）

## 会话与 HTTP（已落地）

| 项 | 约定 |
|----|------|
| 存储 key | **仅** `strict-rag:web:client-session`（与 admin 隔离） |
| 内容 | `{ accessToken, refreshToken, session }` |
| http | `apps/web/src/lib/http.ts`：Bearer + 单飞 refresh（JSON API） |
| refresh URL | `POST /api/v1/auth/web/token/refresh` |
| 消费者 | 默认 `web_consumer`（无 `admin.shell`）；ask 靠 **KB 成员**，不靠运营码 |
| 会话 API | `src/api/sessions.ts` → api sessions 路由 |
| 会话编排 | `src/services/sessions.services.ts`（无 path） |
| 反馈 API | `src/api/feedback.ts` · UI：`ask-panel` FeedbackBar |
| 引用回溯 | `src/api/ask.ts` `getAskAudit` → `GET /api/v1/ask/:requestId`；UI：`CitationBlock` |
| 档位 | `src/api/ask.ts` `getAskModes` → `GET /api/v1/knowledge-bases/:kbId/ask-modes`；body `options.mode` |
| 身份 API | `src/auth/api.ts` |
| 客户端 env | `env.client.ts` → 仅公开 API base 等 `NEXT_PUBLIC_*` |

**反模式**：把 admin token 写入 web key；用运营码放行 web 管理能力；本地用历史消息拼 evidence 高亮当引用；把服务端密钥写进 `NEXT_PUBLIC_*` 或任意 web 源码。

## 前端测试（Vitest + RTL）· 可执行约定

| 项 | 约定 |
|----|------|
| 运行 | `pnpm --filter @strict-rag/web test` |
| 环境 | `vitest.config.ts`：`environment: 'jsdom'` · `include: ['tests/**/*.test.{ts,tsx}']` · alias `@` → `src` |
| 基建 | **仅** `src/test/`：`setup.ts`（jest-dom · cleanup · 清 storage）· re-export；ask final **工厂 SSOT** 见下 |
| 用例位置 | **现行** `tests/<能力>/<意图>.test.ts(x)`；组织 HOW：[testing](../../guides/testing.md)；导航 `tests/index.md`。禁止再按源码同域镜像 |
| 查询 / 交互 | `getByRole` / `getByLabelText` · `userEvent.setup()`；禁 `querySelector` 测行为 |
| Provider | **无**全局假 `renderWithProviders`（当前无 QueryClient 等）；需要时在单测内包；直接 `render` |
| 必测红线 | final schema · lastQuestion 重试 · ready 无 final · session key 与 admin 隔离 · **P0 表 R1–R4/R10** |
| P0 清单 | 仓库 `docs/testing/p0-redlines.md`；关闭该行的关键 `it` 标题含 `R#:`（同文件其它 it 可不改） |
| 勿堆 | 登录页冒烟、每个 thin CRUD 全路径、全站 E2E；改到再补 |
| E2E | 不放 `src/`；另目录/包；默认不进 `pnpm test` |

### Convention: ask final fixture SSOT（R10）

**What**：`makeAnsweredFinal` / `makeAbstainedFinal` 权威工厂在 **`@strict-rag/contracts/testing`**（非主入口 `@strict-rag/contracts`）。

**Why**：web/api/contracts 共用同一 payload，避免双份 JSON 分叉导致「双端都绿却跨层假绿」。

**Example**：

```ts
// Good — 直接或经兼容 re-export
import { makeAbstainedFinal } from '@strict-rag/contracts/testing';
// apps/web/src/test/fixtures/ask.ts 仅 re-export 同工厂

// Bad — apps 内再抄一份 AskResponse 字面量当「同源」
```

**Related**：contracts [directory-structure · testing 导出](../../contracts/library/directory-structure.md)；清单 R10。

### Convention: client-session 读路径测对齐 IS（R4）

**What**：`readClientSession` **不**按 `expiresAtMs` 失效；红线测断言 **clear / 坏 JSON / 从未写入 → null**。

**Why**：按「过期应 null」写测会逼产品改代码或假绿；expires 产品闸属 follow-up（总 backlog **DEC-1**），非 R4。

```ts
// Good：坏 JSON → null 且清 key
localStorage.setItem(WEB_KEY, '{not-json');
expect(readClientSession()).toBeNull();

// Bad：断言「expiresAtMs 已过 → null」而实现无此分支
```

### Session fixture（`saveClientSession`）

`session` 须满足 contracts `AuthSession`（**非**自造 `{ expiresAt }`）：

```ts
session: {
  sessionId: string;
  userId: string;
  app: 'web'; // admin 包用 'admin'
  roles: string[];
  permissions: string[];
  expiresAtMs: number; // 正整数 ms，不是 ISO 字符串
}
```

`tsc --noEmit` **会扫** `*.test.ts`（tsconfig include 全量）；fixture 形状错会红。

### 必测断言点（web）

| 场景 | 断言 | P0 |
|------|------|-----|
| 合法 `data-ask-final` answered/abstained | `view.type` 对应；非法 payload → `error` + 文案含终态无效 | R10 同工厂 |
| `status`→`ready` 且仍 loading | `view.type==='error'`；先 final 再 ready **不**覆盖 answered | **R1** |
| AskPanel abstained | `role=alert` 含拒答语义；**非**普通答案正文 / 非系统崩溃文案 | **R2** |
| mapBizError 已知 code | 文案含 `CODE:` + message | **R3** |
| session clear / 坏 JSON / 无写入 | `readClientSession()` → null | **R4** |
| AskPanel 重试 | 提交后 input 空；点重试仍 `ask(lastQuestion)` | — |
| session key | 只写 `strict-rag:web:client-session`；不写 admin key | — |

## 流式 view 状态机（`use-knowledge-ask`）

**实现**：`apps/web/src/hooks/use-knowledge-ask.ts`  
**view**：`idle | loading | answered | abstained | error`

| 输入 | 结果 view |
|------|-----------|
| `data-status` phase≠error | `loading` + phase |
| `data-status` phase=error | `error`（code/message） |
| `data-ask-final` schema OK + status answered | `answered` |
| `data-ask-final` schema OK + status abstained | `abstained` |
| `data-ask-final` schema 失败 | `error` INTERNAL「流式终态载荷无效」 |
| `useChat` status submitted/streaming | 保证进入/保持 loading |
| `useChat` status **ready** 且当前仍 loading | **error** INTERNAL「流式响应未包含有效终态」 |
| 已 answered/abstained 后再 ready | **不覆盖**（functional setView 仅 loading→error） |

```ts
// Correct：ready 兜底（只动 loading）
if (status === 'ready') {
  setView((prev) =>
    prev.type === 'loading'
      ? { type: 'error', code: 'INTERNAL', message: '流式响应未包含有效终态' }
      : prev,
  );
}
```

## 反模式

- **Bad**：拒答卡片用 `destructive` / 红色系统错误样式（应 `abstain`）  
- **Bad**：ask-panel 大面积 `style={{}}` 或 `bg-[#f5f3ff]`（应 token + Alert/Badge）  
- **Bad**：前端在本地用历史消息拼 evidence 高亮当引用  

- **Bad**：debug 开关默认打开并展示内部 trace 给终端用户  
- **Bad**：手写 `event: final` 解析或每个 SSE event 都 `setAnswer` 覆盖 final  
- **Bad**：`data-ask-final` 不经 `AskResponseSchema` 盲 `as`  
- **Bad**：`onSubmit` 先 `setQuestion('')`，`onRetry` 再读 `question` → 重试按钮死  
- **Bad**：流结束 `status=ready` 仍 `view=loading` 且无兜底 → 提问按钮永久 disabled  
- **Bad**：`renderWithProviders` 无 Provider 却假封装；在 `src/` 旁按文件再添 `*.test.ts`  
- **Good**：answered / abstained / 错误态三套明确 UI；只应用校验通过的 final payload  
- **Good**：`lastQuestion` 记最近成功发起的文案；重试 `submitQuestion(lastQuestion \|\| question)`  
- **Good**：测例进 `tests/<能力>/` + `src/test/` 仅基建 + `tests/index.md` 有行  

## 模块分层反模式（摘要）

> 全文：[module-layering.md](./module-layering.md)

- **Bad**：组件 / hooks / services 内写业务 path（path **只**在 `src/api/*` 或 `auth/api`）  
- **Bad**：services 与 hooks 双份同一用例编排  
- **Bad**：为对称空建 `app/**/api.ts` / 空 features / 空 store  
- **Bad**：平行 wire `types.ts` 复制 contracts  
- **Bad**：services/hooks 内用运营码 / 自造权限树放行业务（授权在 **API**；前端只 Guard + 映射错误）  
- **Bad**：**欠抽** — 多 services 复制同形错误映射却不进 `lib/`；**过抽** — 把 ask 流与会话壳合成上帝 hook  
- **Good**：`api` 浅（path/transport）+ hook/services 深（用例/状态机）+ `page` 薄  
- **Good**：无 React → services；须订阅 → hooks；膨胀按 **业务** 拆 `*.services.ts`  
- **Good**：抽公共时机见 [module-layering §12.1](./module-layering.md)（与 [admin §12.1](../../admin/frontend/module-layering.md) 同纪律）

### Common Mistake: 重试依赖已清空输入

**Symptom**：error/abstained 后点「重试」无网络请求。

**Cause**：提交时清空 input，重试仍读同一 state。

**Fix**：独立 `lastQuestion`（或失败时回填输入框）；重试走与提交相同的 `ask(q)` 路径。

**Prevention**：改 `ask-panel` 提交/重试路径必跑 `tests/ask/abstain-alert.test.tsx` 中 lastQuestion 用例。

### Common Mistake: 流结束无 final 卡在 loading

**Symptom**：提问按钮长期 `处理中…` / disabled；无答案也无错误卡。

**Cause**：`useChat` 已 `ready`，但从未收到合法 `data-ask-final`（断流、网关截断、解析失败）；仅靠 status=streaming 进 loading，无离开路径。

**Fix**：`status==='ready'` 时若 `view.type==='loading'` → error「流式响应未包含有效终态」。有 final 后 view 已非 loading，ready **不得**覆盖 answered/abstained。

**Prevention**：`tests/ask/stream-ready-no-final.test.ts` 覆盖「ready 仍 loading → error」与「final 后再 ready 保持 answered」。

### Common Mistake: 测试 fixture 假 session 过 tsc

**Symptom**：`pnpm check-types` 红，测却绿（vitest 不验完整类型）。

**Cause**：`saveClientSession` 要 `AuthSession`（`app` · `permissions` · `expiresAtMs`），fixture 只写了 `roles` + ISO `expiresAt`。

**Fix**：按上文 Session fixture 填全；web `app:'web'`，admin `app:'admin'`。
