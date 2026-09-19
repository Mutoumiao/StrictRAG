# QUAL-AA1：KB 策略参数可保存 + 审计

Type: task
Status: open
Blocked by: 02

## Question

剧本 AA1：「KB 策略参数**可保存** + **审计**；旧文档 chunk 边界 / version 不变」。IS：settings 白名单无策略参数；设置页只读展示已实现策略；前图 88 已把分片策略 PATCH 的 diff 落 `kb_settings_audits`（键 `chunkStrategy.<code>.<field>`，复用不新建表）。

请先**判定剩余差什么**才满足 AA1 的 Then，逐条给证据行：

1. 「参数可保存」是否已被 88 覆盖？还是仍缺 settings 白名单 / 上传与 reindex 必选参数面（B12 已落注册表 + complete/reindex 闸）？
2. 「审计」是否已由 88 覆盖？覆盖到哪一层（KB 库启用表 vs 文档级）？
3. 「旧文档 chunk 边界 / version 不变」是否需要**新证据**（现有测例是否已断言旧文档 version 与边界不动）？

然后按判定收口：**若已具备则只补缺失的测**（不得写新实现充数）；**若缺则补最小实现**。

约束：不改 ADR-053 语义；不得让旧文档自动切策略；旧文档版本与快照不变。

## Answer

<!-- 解析时写 -->
