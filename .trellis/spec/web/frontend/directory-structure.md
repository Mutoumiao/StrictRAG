# web · 目录结构

## 当前

```text
apps/web/
  package.json
  tsconfig.json    # 同 admin：DOM + jsx preserve + Bundler
  eslint.config.js # next-js
  src/app/
    placeholder.ts # APP_WEB_SCAFFOLD = true
```

## 目标职责

| 职责 | 说明 |
|------|------|
| 用户 ask | 默认 SSE；会话列表/历史（P2 多会话壳） |
| pure read | 只读用户主阵地 |
| 登录 UI | 与 admin 两套 UI、同一身份体系 |

## 建议（实现时）

```text
src/app/           # App Router 页面
src/components/    # 会话、消息、citation、拒答态
src/lib/api/       # fetch/SSE 客户端，类型来自 contracts
```

接入 Next 时对齐 catalog 中 `next`/`react` 版本；端口 **3005**。
