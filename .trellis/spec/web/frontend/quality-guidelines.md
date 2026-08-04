# web · 质量指南

## 产品语义（实现 UI 时）

| 规则 | 说明 |
|------|------|
| 拒答可见 | 失败 reason 映射用户文案；禁止伪装成成功答案 |
| citations | 仅展示服务端返回的合法 id；不可前端「补编」引用 |
| options | 只传白名单：stream / debug / mode / locale |
| scope | 产品检索 scope（如 `docTypes`）放在 **请求顶层** `scope`，**禁止**塞进 `options`（ADR-050） |
| 质量阈值 | 禁止 UI 暴露 tauClaim 等调参给普通用户 |

## 技术约定

- `cn` / theme 同 admin → `@strict-rag/ui`  
- ESLint：`next-js` 配置  
- 与 admin **拆包**：勿把管理页塞进 web  

## 会话与 HTTP（已落地）

| 项 | 约定 |
|----|------|
| 存储 key | **仅** `strict-rag:web:client-session`（与 admin 隔离） |
| 内容 | `{ accessToken, refreshToken, session }` |
| http | `apps/web/src/lib/http.ts`：Bearer + 单飞 refresh |
| refresh URL | `POST /api/v1/auth/web/token/refresh` |
| 消费者 | 默认 `web_consumer`（无 `admin.shell`）；ask 靠成员，不靠运营码 |

**反模式**：把 admin token 写入 web key；用运营码放行 web 管理能力。

## 骨架阶段

Phase 0/1 壳 + 鉴权客户端就绪；Phase 2 前不做完整 chat 充数。

## 反模式

- **Bad**：前端在本地用历史消息拼 evidence 高亮当引用  
- **Bad**：debug 开关默认打开并展示内部 trace 给终端用户  
- **Good**：answered / abstained / 错误态三套明确 UI
