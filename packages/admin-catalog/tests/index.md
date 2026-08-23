# @strict-rag/admin-catalog · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：权限码、角色模板、菜单树 SSOT。验码在 api，裁剪 UI 在 admin。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与验收剧本。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `acl/` | 权限码合法性、角色默认码、菜单挂码 | ADR-051 · ADR-056 |

## 测例

| 文件 | 目标 | 需求锚点 | 被测 | 简介 | 状态 |
|------|------|----------|------|------|------|
| `acl/catalog-clip.test.ts` | 码表、角色模板与菜单树必须一致，clip 后只保留有码且已落地的路由。 | ADR-056 | `defaultCodesForRoles · filterMenuByCodes · clipMenuForShell` | 无 React；只校验码表、模板、菜单树一致且可裁剪。 | 现行 |

## 待处理

（无。`src/` 下已无 `*.test.ts(x)`。）
