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

### 前端细化（admin / web · 与分层 check 对齐）

> 权威细则（A 必须抽 / B 禁止过抽 / C 可选 / 形态优先级）：  
> [admin/frontend/module-layering §12.1](../admin/frontend/module-layering.md) · [web/frontend/module-layering §12.1](../web/frontend/module-layering.md)  
> **X-31**：双端 **各保留** module-layering（路由/权限/壳不同）；**不**强行抽第三份 guides SSOT。共享原则只写在本文件 + 两端交叉链接。

| 问自己 | 倾向 |
|--------|------|
| 是 **无 React 的同形纯逻辑**（`mapErr`、format）已在 ≥3 文件？ | **抽** → `src/lib/*` 纯函数（A1） |
| 只是 UI 都有 loading 四态，但权限/数据/动作已分叉？ | **不抽** 大 hook（B1）；允许样板税 |
| 改加载协议要动 ≥4 个路由模块？ | **抽** 极薄骨架 / 协议 helper（A2） |
| 抽完要传一堆 options 才能还原？ | **过抽** → 内联（B4） |
| ask 流 + 会话列表「长得像」？ | **禁止** 合成上帝 hook（web B 类） |

`trellis-check` 跑前端 Quality Check 时：**欠抽与过抽都要报**，不能只骂重复或只骂抽象。

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

## 本仓已有可复用点（X-32 · 与源码对齐）

| 符号 / 文件 | 用途 |
|-------------|------|
| `BizCode` · `packages/contracts/src/common/biz-code.ts` | 业务异常码常量 |
| `buildSuccess` / `buildFailure` · `response.ts` | 响应信封 |
| `AskRequestSchema` / `AskResponseSchema` · `ask/*` | 问答 DTO + 流 final |
| `IMPLEMENTED_CHUNK_STRATEGIES` · `ingest/chunk-strategy.ts` | 可写/可执行策略集（X-03） |
| `QUEUE_NAMES` · contracts async | BullMQ 队列名 SSOT |
| `isDefaultRetrievable` · `@strict-rag/db` | 检索 L0 双闸 |
| `PERMISSION_DEFINITIONS` · admin-catalog | 权限码字典（**非** contracts） |
| `hydrateAuthz` · `apps/api/src/auth/role-hydrate.ts` | 运行时有效码 |
| `cn` · `packages/ui/src/lib/utils.ts` | className 合并 |
| `theme.css` · CSS 变量 `--sr-*` | 主题 token |
| ESLint `base` / `next-js` / `react-internal` | 按运行时选配置 |
| tsconfig `base` / `node` / `nextjs` / `react-library` | 按包类型 extends |

> 清单**不是**第二 IS；完成度以 `docs/module-status` + 源码为准。过时符号从本表删除，勿留「将有」。

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
- **Bad**（前端）：三 ops 页仅形状像就 `useOpsWorkspace(config)`；或 ≥3 处 `mapErr` 仍不抽 `mapBizError`  
- **Good**：按 `prds/02-engineering` 建议位置，有真实调用再抽包  
- **Good**（前端）：纯函数优先；UI 状态机未达 A2 前允许复制；见 module-layering §12.1  

---

## 与 catalog 依赖

新增第三方库：

1. 能进 `pnpm-workspace.yaml#catalog` 的优先登记  
2. 业务包用 `catalog:` 引用  
3. 对照 `prds/01-architecture/02-tech-stack-frozen.md` 是否在允许表内
