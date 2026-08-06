# web · 质量指南

## 产品语义（ask UI）

| 规则 | 说明 |
|------|------|
| 拒答可见 | 失败 reason / userMessage 映射用户文案；禁止伪装成成功答案 |
| citations | 仅展示服务端返回的合法 id；不可前端「补编」引用 |
| options | 只传白名单：stream / debug / mode / locale |
| scope | 产品检索 scope（如 `docTypes`）放在 **请求顶层** `scope`，**禁止**塞进 `options`（ADR-050） |
| 流式终态 | **只信 `data-ask-final`**（`AskResponseSchema.safeParse` 通过后才更新 answered/abstained） |
| 流式进度 | `data-status`（transient）仅驱动 loading phase；`phase=error` 可进错误态 |
| 重试 | 提交后会清空输入框 → **必须**保留 `lastQuestion`（或等价）；`onRetry` **禁止**只读已空的 `question` |
| 禁止 | 自写 SSE 分帧；用 text-delta / 中间事件覆盖终态答案 |
| 质量面板 | 禁止 UI 暴露 tauClaim 等调参给普通用户 |
| rewrite | P2 强制关；debug 若展示须 `rewriteUsed=false` |

## 技术约定

- `cn` / theme → `@strict-rag/ui`  
- ESLint：`next-js` 配置  
- 与 admin **拆包**：勿把管理页塞进 web  
- 类型：`AskRequest` / `AskResponse` / BizCode 来自 `@strict-rag/contracts`  
- 流客户端：`@ai-sdk/react` `useChat` + `ai` `DefaultChatTransport`（`src/api/ask.ts` · `hooks/use-knowledge-ask.ts`）

## 会话与 HTTP（已落地）

| 项 | 约定 |
|----|------|
| 存储 key | **仅** `strict-rag:web:client-session`（与 admin 隔离） |
| 内容 | `{ accessToken, refreshToken, session }` |
| http | `apps/web/src/lib/http.ts`：Bearer + 单飞 refresh（JSON API） |
| refresh URL | `POST /api/v1/auth/web/token/refresh` |
| 消费者 | 默认 `web_consumer`（无 `admin.shell`）；ask 靠 **KB 成员**，不靠运营码 |
| 会话 API | `src/api/sessions.ts` → api sessions 路由 |
| 身份 API | `src/auth/api.ts` |

**反模式**：把 admin token 写入 web key；用运营码放行 web 管理能力；本地用历史消息拼 evidence 高亮当引用。

## 反模式

- **Bad**：前端在本地用历史消息拼 evidence 高亮当引用  
- **Bad**：debug 开关默认打开并展示内部 trace 给终端用户  
- **Bad**：手写 `event: final` 解析或每个 SSE event 都 `setAnswer` 覆盖 final  
- **Bad**：`data-ask-final` 不经 `AskResponseSchema` 盲 `as`  
- **Bad**：`onSubmit` 先 `setQuestion('')`，`onRetry` 再读 `question` → 重试按钮死  
- **Good**：answered / abstained / 错误态三套明确 UI；只应用校验通过的 final payload  
- **Good**：`lastQuestion` 记最近成功发起的文案；重试 `submitQuestion(lastQuestion \|\| question)`  

## 模块分层反模式（摘要）

> 全文：[module-layering.md](./module-layering.md)

- **Bad**：组件 / hooks / services 内写业务 path（path **只**在 `src/api/*` 或 `auth/api`）  
- **Bad**：services 与 hooks 双份同一用例编排  
- **Bad**：为对称空建 `app/**/api.ts` / 空 features / 空 store  
- **Bad**：平行 wire `types.ts` 复制 contracts  
- **Bad**：services/hooks 内用运营码 / 自造权限树放行业务（授权在 **API**；前端只 Guard + 映射错误）  
- **Good**：`api` 浅（path/transport）+ hook/services 深（用例/状态机）+ `page` 薄  
- **Good**：无 React → services；须订阅 → hooks；膨胀按 **业务** 拆 `*.services.ts` |

### Common Mistake: 重试依赖已清空输入

**Symptom**：error/abstained 后点「重试」无网络请求。

**Cause**：提交时清空 input，重试仍读同一 state。

**Fix**：独立 `lastQuestion`（或失败时回填输入框）；重试走与提交相同的 `ask(q)` 路径。
