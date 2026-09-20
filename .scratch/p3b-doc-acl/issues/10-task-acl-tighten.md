# 落 ACL 收紧的索引一致性

Type: task
Status: open
Blocked by: 07

## 做什么

按 `07-dec-acl-tighten-reindex.md` 的裁定落地（自动入队或明确人工口径 + 文档化），并把镜像陈旧项（`docs/module-status/api.md`、`docs/testing/coverage/02-acl.md` 里关于「缺激活 version 表示」的旧叙述）按源码核实回写。

## 完成判据

- 裁定所选路径有可核对证据（入队则 mock 队列断言恰好一次；人工则口径写进 spec 与镜像）。
- B2-2 的 Then 有明确的成立口径与对应测例。
- `pnpm check-types` + `pnpm lint` + 相关包测试全绿。

## Answer

（待填）
