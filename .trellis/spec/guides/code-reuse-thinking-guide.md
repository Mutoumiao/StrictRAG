# 代码复用思考指南 · StrictRAG

> 目的：改常量、抽 helper、复制逻辑前先搜仓；共享物落到正确包。

---

## 先搜再写

```bash
rg "BizCode|buildSuccess|buildFailure" packages apps
rg "cn\(" packages apps
rg "PERMISSIONS|MENU_TREE" packages
```

重复第三次出现同一逻辑时，再抽共享——不要为「将来可能」预建工具包。

---

## 共享落点决策

| 要共享的东西 | 放哪里 | 不要放 |
|--------------|--------|--------|
| HTTP DTO / Zod / BizCode / ApiResponse | `packages/contracts` | apps 内私有再导出 |
| 权限码 · 菜单树 | `packages/admin-catalog` | admin 与 api 各抄一份 |
| PG schema · migrate | `packages/db` | 仅 api 或仅 worker |
| className 合并 · 主题 token · 基础组件 | `packages/ui` | 各 app 复制 `cn` |
| ESLint / tsconfig | `packages/eslint-config` · `typescript-config` | 每包独立大段配置 |
| Hono 路由 · BullMQ processor | 对应 app | packages 里塞业务 HTTP |
| 长 Prompt / 图节点 | 未来专模块（非 route 内联） | `apps/web` |

---

## 本仓已有可复用点

| 符号 / 文件 | 用途 |
|-------------|------|
| `BizCode` · `packages/contracts/src/common/biz-code.ts` | 业务异常码常量 |
| `buildSuccess` / `buildFailure` · `response.ts` | 响应信封 |
| `HealthResponseSchema` · `system/health.contract.ts` | health/ready 形状 |
| `cn` · `packages/ui/src/lib/utils.ts` | className 合并 |
| `theme.css` · CSS 变量 `--sr-*` | 主题 token 占位 |
| ESLint `base` / `next-js` / `react-internal` | 按运行时选配置 |
| tsconfig `base` / `node` / `nextjs` / `react-library` | 按包类型 extends |

---

## 常量修改协议

改 `BizCode`、权限码字符串、队列名、env 键名时：

1. `rg` 全仓引用  
2. 更新 contracts 或 catalog 源  
3. 更新依赖方与 PRD（若已冻接口）  
4. 跑 `pnpm check-types` · `pnpm lint`

---

## 反模式

- **Bad**：在 admin 写 `const AUTH_UNAUTHORIZED = 'AUTH.UNAUTHORIZED'`  
- **Bad**：再 scaffold 一个 `packages/utils` 装 2 个函数  
- **Bad**：为未批准 Phase 预建空的 `packages/rag-graph` 却无 PRD 落点说明  
- **Good**：按 `prds/02-engineering` 建议位置，有真实调用再抽包  

---

## 与 catalog 依赖

新增第三方库：

1. 能进 `pnpm-workspace.yaml#catalog` 的优先登记  
2. 业务包用 `catalog:` 引用  
3. 对照 `prds/01-architecture/02-tech-stack-frozen.md` 是否在允许表内
