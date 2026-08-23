# 试点打开 AUTH_ENFORCE（不改仓库默认）

仓库 **Zod / `.env.example` 默认仍 `AUTH_ENFORCE=false`**。本页只写本地试点步骤。QUAL-1 自动化测仍是红线，不替代本配方。

## 1. 只改本地 `.env`

```bash
# 在已有 .env 中显式写（不要改 .env.example）
AUTH_ENFORCE=true
```

重启 **api**（worker 无此开关）。

## 2. 无 Bearer → 401

```bash
curl -sS -o /tmp/ae.json -w "%{http_code}" http://127.0.0.1:4000/api/v1/knowledge-bases/:kbId/documents
# 期望 401；body error.code 为约定短名（见 QUAL-1）
```

## 3. 开发登录仍可用（仅 APP_ENV=development|test）

Admin：

```bash
curl -sS -X POST http://127.0.0.1:4000/api/v1/auth/admin/dev-login \
  -H 'content-type: application/json' \
  -d '{"email":"ops@local.dev","roleTemplate":"super_admin"}'
```

Web：

```bash
curl -sS -X POST http://127.0.0.1:4000/api/v1/auth/web/dev-login \
  -H 'content-type: application/json' \
  -d '{"email":"user@local.dev"}'
```

把返回的 `data.accessToken` 放到 `Authorization: Bearer …`。运营页 / 问答页走既有登录表单即可。

## 4. QUAL-1 红线测

```bash
pnpm --filter @strict-rag/api test -- tests/auth/enforce-401.test.ts
```

## 明确不是

- 把仓库默认改成 `true`  
- Better Auth 生产 IdP  
- 宣称已生产鉴权
