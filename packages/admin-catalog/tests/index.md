# @strict-rag/admin-catalog · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：权限码、角色模板、菜单树 SSOT。验码在 api，裁剪 UI 在 admin。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `acl/` | 权限码合法性、角色默认码、菜单挂码 | ADR-051 · ADR-056 |

## 测例

（尚无 `tests/<能力>/` 现行文件。）

## 遗留（待迁）

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/catalog.test.ts` | 码表、模板、菜单树一致且可 clip | ADR-056 | 无 React；数据-only | 遗留 |
