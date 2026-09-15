# 裁定反馈回流黄金集后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 84

## Question

[反馈回流黄金集最小闭环](./84-feedback-promote-gold-min.md) 完成后。PATCH `promoted_to_gold` 已真写 `gold_questions`；用户 POST 不写黄金集。仓库默认强制仍关。这仍不是人签、不是准出 PASS、不是真 OCR 引擎、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写完整体验其余（BlockNote / editor-draft / web 编辑器）仍是 P2.x 余量
- 反馈回流切边（`gold.yaml` 审核闸 / 自动入队 `eval/runs` / 改 2×2 / 再认证 / 签字包链）不并进已关工单
- L0/contextMode 切边（真 L1 Gateway / 通用表单引擎 / chunkTokens 消费）不并进已关工单
- 跨文档去重切边（`pending_review` / `downrank` / 跨 KB / 生产 LSH）不并进已关工单
- KB 绑定切边（平台绑定页 / catalog 权限 / fallbacks 多行）不并进已关工单
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- P3b 可动手最小闭环已齐；默认开 `DEPT_ACL_ENFORCE`、角色 principal 仍锁
- P4 可动手代码真空已尽
- P5 OCR 开闸 / 历史重跑切边不并进已关工单

候选：

1. **在线编写余量**：BlockNote、editor-draft、web 用户编辑器
2. **P5 余量**：真 OCR 引擎 / Cloud / 自动全库 / 容量 / 抽样 / CoVe
3. **回头 P3b 余量**（须先解锁站规）
4. **本图暂停执行**，等图外 L2 人签或真 OCR 引擎选型
5. **回头 P4 人签/面板雾**

本工单只锁顺序与切边，不写产品代码。

研究输入：[research-next-after-84.md](../research-next-after-84.md)（合并自两份独立研究：功能表权威面 `.scratch/fill-must-haves/research-next-after-84-table.md`、源码 IS 面 `research-next-after-84-source.md`）。

## Answer

反馈回流黄金集之后，**BlockNote / editor-draft / web 编辑器仍是 P2.x 完整体验余量**；P5 真引擎仍是选型；P3b 站规仍锁；P4 人签 / 面板仍不是代码缺口。五选一里 1/2/3/5 都不是卡住的产品路径；4 只在剩余项都依赖人签或选型时才合理。当前不是。

本轮把口径从「上一轮候选清单」换成 **功能表 + `prds/00–11` + 验收剧本 P2 必签行**重新对齐，发现两条**从未被本图任何工单覆盖**的必须具备行（不在已锁清单，也不在原雾清单，此前只躺在 `08-06-project-backlog/status.md` §2.5.2 的 `QUAL-*` 指针上标「未开始」）。两条都指得到冻结条款、源码三层同缺、不等人签 / 不选引擎 / 不解锁站规。

**本批串行三张**（前两张为新增必须具备，第三张为 IA 明文的运营审计面）：

1. [提交者不可自审四眼最小闭环](./86-no-self-approve-min.md) — 信任环红线，**先做**。
2. [角色与权限树状勾选最小闭环](./87-role-permission-tree-min.md) — 紧后。
3. [分片策略保存写服务端修改日志最小闭环](./88-chunk-strategy-audit-min.md) — 紧后。

**不并进本批**：孤儿清理（孤儿清理最小闭环，下一轮首张）、参数快照只读审计、签字包链、断线重拉、citation chunk 级去重、`dedupe_cross_doc_rate`、metrics `fallback` 维、原生 `<select>` 站规清扫、真 L1 `contextualize`、`pending_review`。

**本批明确不做**：`allowSelfApprove` 显式开关（ADR-048 允许，但方向是「放宽」，不进本批）、独立审批工单表、`approve` 自动入队 scan、`task.py create` 平行实现任务、改 `prds/00–11`。

### 逐条切边

**86 · 提交者不可自审四眼**

- 权威：`prds/09-security/01-auth-acl-compliance.md`「禁自审默认｜提交者默认不可批自己的单（P2）」；`prds/05-api/01-http-api-hono.md` §approve（ADR-048）「默认拒绝自审」；ADR-048 #4 四眼；`prds/03-data/01-postgresql-schema.md` 审批表「`decided_by` **默认 ≠** `submitted_by`」；`prds/00-product/02-scope-and-non-goals.md`「普通文档人员默认自审通过入库｜禁止」；功能表 §4.3 / §4.4；剧本 V3。
- 现状：`packages/db/src/schema/kb/documents.ts:38-40` 的 `uploaded_by` / `approved_by` / `approved_at` 全仓无写入方；`apps/api/src/routes/documents/index.ts:433-486` 的 approve / reject 只判 `approvalStatus`；admin 审批面无「提交人」列。
- 做：complete / write 写 `uploaded_by`；approve 写 `approved_by` + `approved_at`；approve / reject 比对 `actor.userId === doc.uploadedBy` → **403** + 明确业务码；**无 actor（`AUTH_ENFORCE` 关）不误伤**——不比对、不编造提交人，口径与既有 `requirePermissionWhenEnforced` 一致；admin 审批面回显提交人（无则「—」）。
- 不做：`allowSelfApprove` 开关、独立工单表、自动入队 scan、审计管理台。

**87 · 角色与权限树状勾选**

- 权威：`prds/00-product/05-frontend-ia.md` §2.4「编辑 = **树**（L1/L2 菜单 + 操作）勾选 code」；功能表 §4.1「树状勾选菜单/操作码」；`prds/09-security` 表「角色树 UI｜P2 必达」。
- 现状：`apps/admin/src/app/(ops)/roles/_components/roles-workspace.tsx` 是扁平 `catalog.map` 单层网格，页头却写「树状授码」；`packages/admin-catalog/src/menu-tree.ts` 的 `MENU_TREE` 存在且**已被壳消费**（`admin-shell.tsx`），但角色页不 import `@strict-rag/admin-catalog`。
- 做：角色页按 `MENU_TREE` 分组渲染 L1/L2 菜单 + 操作码勾选；未挂到任何菜单节点的码仍须可见可勾（**禁止静默丢码**）；超管锁全码（工单 31）语义不变。
- 不做：改鉴权语义、改码表 / 契约、加层级列 / 加 API、改菜单裁剪。

**88 · 分片策略保存写服务端修改日志**

- 权威：`prds/00-product/05-frontend-ia.md` §2.2「审计：可写保存 → 服务端修改日志」；功能表 §4.2 末段 / §4.5；剧本 AA1（KB 策略参数可保存 + 审计，旧文档 version 不变）。
- 现状：`apps/api/src/routes/chunk-strategies.ts` 的 PATCH 不写审计；`apps/api/src/middleware/admin-write-audit.ts` 白名单不含该路径；对照 KB 设置 PATCH 已写 `kb_settings_audits`。
- 做：分片策略 PATCH 有 diff 时落服务端修改日志（复用既有审计形态，**不加新表**）；无 diff 不落；旧文档 `index_version` / 快照**不变**。
- 不做：改策略解析语义、改旧文档、把 ARCH-P1b-2 的 Pino 写操作日志改成落表。

仍留雾：仓库默认开强制、角色 principal、BlockNote / editor-draft、P3a、P4 其余、P5 其余、B8 / B9 / QUAL-2、MD/TXT 更严体积、魔数嗅探、真 L1 contextualize、`pending_review`、QUAL-G3 `gold.yaml` 审核闸、QUAL-K5 Langfuse 明文 ACL（仅 mock）、三平面 `maxEmbedCalls` / embed TPM / staging fail-closed（35 切边维持）、ES 租户迁移（ADR-041）。

**顺带锁一条张力**：剧本 R 把 R4 / R6 / R10 标 P2 必签，而工单 35 已划出 `maxEmbedCalls` / embed TPM / staging fail-closed —— **维持 35 切边**，R4 / R6 / R10 归部署与计量基建，不在本图重开。

未改产品代码。

## Comments

- 2026-09-16 用户要求继续 wayfinder，在主分支推进，授权本图全程自行决策。认领并裁定。
- 派发两个**角色互斥**的研究子代理并行取证：①「功能表权威面盘点」——从功能表 + `prds/00–11` + 验收剧本反查仍未落地的必须具备行；②「源码 IS 面证据核对」——对候选逐条在源码取 `路径:行` 证据，独立判定已齐 / 半接线 / 缺失。两份报告结论独立收敛于「禁自审」与「孤儿清理」两条从未进过本图的必须具备行，交叉验证通过；本轮裁定采用了「禁自审」（源码面独立确认 `uploaded_by` / `approved_by` 全仓无写入方，PRD 面独立确认三处冻结条款）。
- Q1：不选 1（余量）。不选 2 整包。不选 3。不选 4。不选 5。
- Q2：本批三张，串行。先信任环红线（禁自审），再两条 P2 必达运营面（角色树、分片策略审计）。
- Q3：禁自审**不**做 `allowSelfApprove` 开关；无 actor 时不误伤，不编造提交人。
- Q4：角色树**禁止静默丢码**；分片策略审计**不加新表**、不改旧文档 `index_version`。
- Q5：默认开强制 / 角色码 / 默认开 OCR / 真引擎 / BlockNote / 人签仍锁；不 `task.py create`；不 push。
