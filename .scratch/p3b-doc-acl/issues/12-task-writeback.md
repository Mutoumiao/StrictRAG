# 回写镜像与覆盖表

Type: task
Status: open
Blocked by: 08, 09, 10, 11

## 做什么

按源码回写：`docs/module-status/api.md` · `worker.md` · `db.md`（触及处），以及 `docs/testing/coverage/02-acl.md`（B2-1…B2-4 / AE4–AE12 行的「覆盖」与「缺口」列、本分册计数表、`:160` 的「非本阶段」一行）。必要时更新 `.trellis/spec/api/` 对应 HOW（例如可见性函数的落点与读法）。

## 完成判据

- 回写只用源码可核对的表述；未验证项（如真 PG 迁移、真 ES 集群）显式标注。
- 遵守前图教训：`docs/module-status/*.md` 正文**不写 `路径:行号`**，不给裸枚举字面量加反引号。
- `pnpm check:module-status` 的 `1-路径` / `6-联动` / `7-时效` 三类保持为空；覆盖表计数与行级重数一致。
- `pnpm test` 全仓全绿。

## Answer

（待填）
