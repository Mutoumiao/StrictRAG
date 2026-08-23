# 测试导航（仓库入口）

> **HOW（怎么写、放哪）**：`.trellis/spec/guides/testing.md`  
> **P0 必绿子集**：[p0-redlines.md](./p0-redlines.md)  
> **产品语义**：`prds/00–11`  
> **验收剧本**（非单测替代）：`prds/10-delivery/03-acceptance-scenarios.md`

本仓测例按 **能力 / 需求** 落在各包 `tests/`，不按源码文件一对一镜像。  
人与 Agent 先打开本页选包，再打开该包 `tests/index.md` 看存货（文件 → 目标）。**测全了没有**看 [p0-redlines.md](./p0-redlines.md) 与验收剧本，不要用 index 宣称覆盖。

## 包目录

| 包 | 导航 | 典型主包职责 |
|----|------|----------------|
| `@strict-rag/web` | [`apps/web/tests/index.md`](../../apps/web/tests/index.md) | 用户问答 UI、流式三态、客户端 session |
| `@strict-rag/admin` | [`apps/admin/tests/index.md`](../../apps/admin/tests/index.md) | 运营壳、菜单裁剪、薄页交互 |
| `@strict-rag/api` | [`apps/api/tests/index.md`](../../apps/api/tests/index.md) | ask 图、检索闸、鉴权、入库 HTTP、评测工程 |
| `@strict-rag/worker` | [`apps/worker/tests/index.md`](../../apps/worker/tests/index.md) | 入库状态机、扫描闸、幂等 |
| `@strict-rag/contracts` | [`packages/contracts/tests/index.md`](../../packages/contracts/tests/index.md) | Zod / 错误码 / ask 形状 |
| `@strict-rag/db` | [`packages/db/tests/index.md`](../../packages/db/tests/index.md) | schema 约束、检索闸纯函数 |
| `@strict-rag/admin-catalog` | [`packages/admin-catalog/tests/index.md`](../../packages/admin-catalog/tests/index.md) | 权限码、角色模板、菜单树 |

`packages/ui`、eslint/typescript-config 无产品测例则不建 `tests/`。

## 命令

```bash
pnpm test
pnpm --filter @strict-rag/api test
```

可选：只跑红线 `it`（非门禁）：

```bash
pnpm --filter @strict-rag/web test -- -t 'R[0-9]+:'
pnpm --filter @strict-rag/admin test -- -t 'R[0-9]+:'
pnpm --filter @strict-rag/api test -- -t 'R[0-9]+:'
pnpm --filter @strict-rag/contracts test -- -t 'R[0-9]+:'
```

## 仓库脚本（非包能力树）

| 文件 | 目标 |
|------|------|
| `scripts/up-stack.test.mjs` | 启动编排脚本契约 |
| `scripts/smoke-ask.test.mjs` | ask 冒烟脚本契约 |
| `scripts/seed-demo.test.mjs` | demo 种子脚本契约 |

这些文件护的是仓库根 `scripts/*.mjs` 本身，不进入某个 app 的 `tests/<能力>/`。  
包内 `src/scripts/*.test.ts`（如 L1 CLI）是能力测，迁徙时进对应包的 `eval/` 等目录。

## 现状（过渡）

现行路径是 `<包>/tests/<能力>/`。大量历史测例仍在 `src/**/*.test.*`，以各包 index 的 **遗留** 表为准。新测例禁止再写入 `src/` 旁。禁止在修 bug 的同一变更里拆混居遗留文件。审阅冻结见 `.trellis/spec/guides/testing.md` §12。
