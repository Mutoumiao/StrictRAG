# 裁定库选择器只列成员库后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 24

## Question

[库选择器只列成员库](./24-kb-picker-members-only.md) 已 `resolved`。本批只做了 web 原生下拉（本次 GET 可见库；空态开通成员；失败重试无输入；脏缓存作废）。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是 admin 顶栏选择器。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官（[裁定 P2 收官后下一步](./13-after-p2-close-order.md)）
- 出口走 L2 归档准出；工程路径 [L2 归档底线](./14-l2-archive-floor.md) 已齐，人签仍图外
- 人签 / 把工程绿写成准出 PASS / 仓库默认打开 rewrite：不进本图执行工单
- P3a 仍等该出口（人签在图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不挡更早语义、不进本回合
- GET `/knowledge-bases` 过滤语义、Ask 成员闸、web 再做一层成员过滤不并进已关工单

候选（来自地图 Not yet specified）：

1. **剩余 P2 半接线**：失败 Webhook、三平面配额、修改日志、启动引导超管、在线编写（完整体验 P2.x）、admin 顶栏手填 uuid
2. **P3b 尚未齐的强制检索面**：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

库选择器只列成员库之后，本图继续收 **剩余 P2 半接线**。本批只做 admin 顶栏当前 KB 选择器。不转 P3b、不跳 P4、不暂停等人签。人签 / 准出 PASS / 仓库默认打开 rewrite / P3a 仍不进执行。

本批一张：

- [admin 顶栏当前 KB 选择器](./26-admin-kb-picker.md) — 开放前沿。在 `@strict-rag/ui` 新增关闭列表下拉；admin 顶栏只用它，禁止粘贴 uuid。空态 / 失败 / 未选中三套文案。脏缓存作废。建库成功选中新建库。不改 GET 过滤，不改 Ask 成员闸。切边见该工单正文。

站规：web/admin 新下拉必须基于 `@strict-rag/ui` 关闭列表，禁止浏览器原生 `<select>` 外壳（含现有 ui `Select`）。web 已落地的原生下拉不在本张回改，另开：

- [web 下拉换 ui 关闭列表](./27-web-select-ui-library.md) — 等本批 ui 组件落地后，把 web 知识库下拉与档位下拉换到同一组件。不改 [库选择器只列成员库](./24-kb-picker-members-only.md) 的过滤 / 空态 / 失败 / 脏缓存语义。

仍留雾：失败 Webhook、三平面配额、修改日志、启动引导超管、在线编写。

未改产品代码。

## Comments

- 2026-08-30 按图顺序认领本工单。开放前沿无执行工单；本回合只锁「库选择器只列成员库后下一步」，不写产品代码。
- Q1：选 1。继续收剩余 P2 半接线。不转 P3b、不跳 P4、不暂停等人签。人签 / 准出 PASS / 默认开 rewrite / P3a 仍不进执行。切哪些、怎么拆，下一问再锁。
- Q2：选 1。本批只做 admin 顶栏。失败 Webhook、修改日志、启动引导超管、三平面配额、在线编写留雾。拆张与切边下一问再锁。
- Q3：选 1。一张执行工单：admin 顶栏用本次 GET 可见库做原生下拉，禁止自由粘贴；测例钉空态 / 列表失败 / 只能选列表项。不改 GET 过滤。各页「填写 UUID」提示随选择器一起改，不另开张。
- Q4：选 1。只能从本次 GET 列表选。空列表不出粘贴框；列表失败走错误态（可重试），不给自由输入。现有「仍可粘贴」测例作废。
- Q5：选 1。localStorage 脏 id 不采用；有可见库则无选中、运营页按未选库走；列表为空仍走空态。不自动改选第一项。
- Q6：选 1。空态 / 失败 / 未选中三套文案分开；空态不说开通成员；有 kb.create 仍可建库；各页「填写 UUID」改为「选择知识库」。
- Q7：选 1。本批在 `@strict-rag/ui` 新增关闭列表下拉（展示名、值为 id；不能输入 uuid）。admin 顶栏用它。web 已落地原生下拉不在本张回改。不做 combobox。现有 ui `Select`（原生外壳）不用于本顶栏。
- Q8：选 1。不改 GET 过滤语义；选择器只消费本次 GET 行。Ask 成员闸不改。admin 不再做一层成员过滤。enforce 关时租户全量、超管旁路维持现状。
- Q9：选 1。建库成功后选中新建库并写入当前 KB（创建者是库管，选项须有这一行）。不改建库权限 / `initialAdminUserId`。
- 用户补规则：所有 UI 端不允许采用原生 UI，都必须基于 `@strict-rag/ui`。与 Q7「web 已落地原生下拉不在本张回改」可能冲突，范围下一问锁。
- Q10：选 1。写成站规：web/admin 以后新下拉必须用 ui 库关闭列表，禁止原生 `<select>` 外壳。本张仍只做 admin 顶栏 + ui 新组件。web 知识库下拉 / 档位下拉回改另开执行工单，不并进本张。
- 2026-08-30 用户确认落盘（`/wayfinder 继续`）：关本工单；建 [admin 顶栏当前 KB 选择器](./26-admin-kb-picker.md)、[web 下拉换 ui 关闭列表](./27-web-select-ui-library.md)。
