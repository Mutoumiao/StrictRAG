# web · 目录结构

## 当前（S2 最小）

```text
apps/web/
  package.json · tsconfig.json · eslint.config.js
  src/
    env.client.ts
    app/
      layout.tsx · globals.css
      page.tsx              # 问答主页（WebAuthGuard + AskPanel）
      login/page.tsx        # web dev-login
    components/
      auth-guard.tsx        # 会话 + /auth/me
      ask-panel.tsx         # answered / abstained / error 三态
    lib/
      http.ts               # Bearer + 单飞 refresh
      ask-sse.ts            # 默认 stream SSE 客户端
      ask-sse-parse.ts      # 只信 final
      sessions-api.ts       # 会话列表/详情壳
    auth/
      client-session.ts     # key: strict-rag:web:client-session
      api.ts                # webDevLogin 等
```

## 职责

| 职责 | 说明 |
|------|------|
| 用户 ask | 默认 SSE；同步 JSON 回退；三态 UI |
| 会话壳 | 列表/历史展示；**不**做 rewrite；历史 ≠ citation |
| pure read | 用户主阵地；无 `admin.shell` 运营面 |
| 登录 UI | 与 admin 两套 UI、同一身份体系（app claim 隔离） |

## 端口

**3005**；API 基址走 `NEXT_PUBLIC_*` / env.client。
