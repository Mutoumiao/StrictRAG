# Monorepo 边界与依赖方向

> 冻结结构：`prds/02-engineering/01-clhoria-template-alignment.md` · ADR-030  
> 栈选型：`prds/01-architecture/02-tech-stack-frozen.md`

---

## 包一览

```text
apps/
  admin/     # Next.js 管理端 · 目标端口 3006
  web/       # Next.js 用户端 · 目标端口 3005
  api/       # Hono + Node · 目标端口 4000
  worker/    # BullMQ consumers · 无 HTTP
packages/
  contracts/       # DTO · BizCode · Zod · 响应信封
  admin-catalog/   # 权限码 + 菜单树（ADR-056）
  db/              # Drizzle schema + migrations（api/worker 共用）
  ui/              # cn · theme · 共享组件
  eslint-config/
  typescript-config/
```

包名：`@strict-rag/<name>`。依赖版本优先 `pnpm-workspace.yaml#catalog`。

---

## 依赖方向（允许）

```text
apps/web  ──HTTP/SSE──►  apps/api
apps/admin ──HTTP─────►  apps/api
apps/api   ──enqueue──►  Redis/BullMQ ──► apps/worker

apps/api     → packages/{contracts, db, admin-catalog}
apps/worker  → packages/{contracts, db}
apps/admin   → packages/{contracts, ui, admin-catalog}
apps/web     → packages/{contracts, ui}

# 工具链（dev）
各 app/package → eslint-config · typescript-config
```

### 当前 package.json 已声明依赖（骨架）

| 包 | dependencies |
|----|----------------|
| `@strict-rag/api` | contracts, db, admin-catalog（**权限求值**） |
| `@strict-rag/worker` | contracts, db |
| `@strict-rag/admin` | contracts, ui, admin-catalog（菜单裁剪） |
| `@strict-rag/web` | contracts, ui（无 admin-catalog 亦可；消费者无运营码） |
| `@strict-rag/ui` | clsx, tailwind-merge, cva；react peer；**Tailwind 构建在 admin/web** |
| `@strict-rag/contracts` | zod（含 **auth TokenPair**） |
| `@strict-rag/admin-catalog` | **无** Next/Hono 依赖；仅数据 SSOT |

---

## 硬边界（禁止）

| 禁止 | 说明 |
|------|------|
| route 内 SQL / ES DSL / 长 Prompt | 放 repository / service / prompt 模块 |
| DB schema 仅放在 `apps/api` | worker 必须共用 `packages/db` |
| 密钥 / `DATABASE_URL` 进入 web/admin 包 | 仅 `NEXT_PUBLIC_*` 可进前端 |
| 前端当 API 授权 | UI 裁剪 ≠ API 验权（双罪禁止） |
| 无 `admin.shell` 进 admin 全壳 | 壳准入验 **`admin.shell`**（ADR-045 经 **051**）；pure read 仅 `apps/web` |
| Prisma 并行 | 唯一 ORM = Drizzle |
| 默认 Cloudflare Workers 运行时 | api = Node 长进程 + BullMQ |

---

## 共享契约规则

- **错误码与 `ApiResponse` 信封只放** `packages/contracts`（见 `biz-code.ts` · `response.ts`）  
- 按域增文件：`common/*` + `system/*` + `kb/*` · `ask/*` 等  
- ESM 子路径导出用 `.js` 后缀：`export * from './common/biz-code.js'`（见 `packages/contracts/src/index.ts`）  
- **测试工厂**：`@strict-rag/contracts/testing`（ask final fixtures）；**禁止**挂主 `"."` 入口；业务 runtime 勿 import  
- P0 红线清单：`docs/testing/p0-redlines.md`（本地 `check-types` + `test`）  
- UI：`import { cn } from '@strict-rag/ui/lib/utils'`；组件 `@strict-rag/ui/components/ui/*`（子路径 exports）  
- UI 主题：`packages/ui/src/theme.css` 为 Tailwind v4 入口；app 只经 `globals.css` 引入（见 [ui · component-guidelines](../ui/frontend/component-guidelines.md)）  
- Next 消费 NodeNext 包：`transpilePackages` + webpack `extensionAlias`（`.js`→`.ts`）；`next build --webpack`

---

## 工程命令

```bash
pnpm install          # 仅 pnpm
pnpm check-types
pnpm lint
pnpm build            # turbo；现为 tsc --noEmit / 占位
pnpm format           # prettier：singleQuote · trailingComma all · printWidth 100
```

根脚本过滤：`pnpm dev:api` · `dev:worker` · `dev:admin` · `dev:web`。

---

## 反模式

- **Bad**：在 `apps/web` 读 `process.env.DATABASE_URL`  
- **Bad**：`apps/api` 私有 `schema.ts` 而 worker 再抄一份  
- **Bad**：handler 里 `db.execute(sql\`...\`)` 拼业务 SQL  
- **Good**：contracts 定义 Zod → api 校验 → service → `packages/db` repository
