# 裁定 web 下拉换 ui 关闭列表后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-human
Blocked by: 27

## Question

[web 下拉换 ui 关闭列表](./27-web-select-ui-library.md) 已 `resolved`。web 知识库与档位已换到 ui `ClosedSelect`；过滤 / 空态 / 失败 / 脏缓存语义未改。admin 顶栏当前 KB 关闭列表已齐。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官（[裁定 P2 收官后下一步](./13-after-p2-close-order.md)）
- 出口走 L2 归档准出；工程路径 [L2 归档底线](./14-l2-archive-floor.md) 已齐，人签仍图外
- 人签 / 把工程绿写成准出 PASS / 仓库默认打开 rewrite：不进本图执行工单
- P3a 仍等该出口（人签在图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不挡更早语义、不进本回合
- GET `/knowledge-bases` 过滤语义、Ask 成员闸、web/admin 再做一层成员过滤不并进已关工单
- 站规：新下拉必须用 ui `ClosedSelect`，禁止原生 `<select>` 外壳

候选（来自地图 Not yet specified）：

1. **剩余 P2 半接线**：失败 Webhook、三平面配额、修改日志、启动引导超管、在线编写（完整体验 P2.x）
2. **P3b 尚未齐的强制检索面**：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

web 下拉换 ui 关闭列表之后，本图继续收 **剩余 P2 半接线**。本批只做启动引导超管。不转 P3b、不跳 P4、不暂停等人签。人签 / 准出 PASS / 仓库默认打开 rewrite / P3a 仍不进执行。

本批一张：

- [启动引导超管](./29-superadmin-bootstrap.md) — 开放前沿。api listen 前对默认租户跑 ADR-056 引导：upsert `permission_definitions`、超管角色写成 catalog 全码、无 active 超管则按 env 创建（或缺则失败）。不是引导页。切边见该工单正文。

仍留雾：失败 Webhook、三平面配额、修改日志、在线编写、写路径锁超管全码。

未改产品代码。

## Comments

- 2026-08-30 按图顺序认领本工单。开放前沿无执行工单；本回合只锁「web 下拉换 ui 关闭列表后下一步」，不写产品代码。
- Q1：选 1。继续收剩余 P2 半接线。不转 P3b、不跳 P4、不暂停等人签。人签 / 准出 PASS / 默认开 rewrite / P3a 仍不进执行。切哪些、怎么拆，下一问再锁。
- Q2：选 1。本批只做启动引导超管。修改日志、失败 Webhook、三平面配额、在线编写留雾。拆张与切边下一问再锁。
- Q3：选 1。一张执行工单覆盖 AD1–AD3：listen 前引导；upsert catalog；超管角色补全码；无超管按 env 创建；缺 env 则启动失败。已有超管不覆盖用户/密码，仍补码。不做引导页、密码登录 HTTP、dev-login、末位超管闸、role_permissions 终态迁表、worker。密码怎么落、要不要新建 permission_definitions，下一问再锁。
- Q4：选 1。新建 `permission_definitions`，启动 upsert catalog 全码；新增补齐、已存在更新元数据、不静默删。运行时求值仍 `codesJson`。不切鉴权到这张表。超管角色补码与密码下一问再锁。
- Q5：选 1。每次启动把 `super_admin.codesJson` 精确写成 `ALL_PERMISSION_CODES`；缺行按种子插入。其它系统角色绑码不重写。PUT/PATCH 剥超管码闸本张先不动（重启补回）。密码下一问再锁。
- Q6：选 1。无超管时 EMAIL+PASSWORD 缺一则启动失败；创建时写不可逆 `password_hash`。已有超管（含 hash 为空）不改这列。不新增验密登录、不改 dev-login、admin 不改密。租户范围与哪些环境 fail closed 下一问再锁。
- Q7：选 1。引导只针对 `DEV_DEFAULT_TENANT`。不扫库、不建 tenants 表、不按请求补引导。哪些 APP_ENV fail closed 下一问再锁。
- Q8：选 1。引导函数所有 APP_ENV 都 fail closed；只在 `index.ts` listen 前调用。`createApp()` 不自动跑。AD1/AD2 单测直接调引导函数。邮箱碰撞下一问再锁。
- Q9：选 1。无 active 超管且 env 邮箱已有用户：复用该行，绑超管、置 active、标运营账号；不改 password_hash。邮箱不存在才创建+写哈希。测例下一问再锁。
- Q10：选 1。测例钉 AD1/AD2/AD3 + Q9 复用邮箱 + `createApp()` 不自动引导 + 其它系统角色绑码不被覆盖 + upsert 不静默删。不做 E2E/浏览器登录。PUT 剥码闸下一问。
- Q11：选 1。本张仍不改 PUT/PATCH 剥超管码闸。写路径锁全码留雾。启动补全码维持 Q5。
- 2026-08-31 用户确认落盘（`/wayfinder 继续`）：关本工单；建 [启动引导超管](./29-superadmin-bootstrap.md)。
