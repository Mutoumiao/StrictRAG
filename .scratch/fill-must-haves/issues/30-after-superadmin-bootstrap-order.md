# 裁定启动引导超管后下一步

Type: grilling
Label: wayfinder:grilling
Status: open
Triage: ready-for-human
Blocked by: 29

## Question

[启动引导超管](./29-superadmin-bootstrap.md) 已 `resolved`。api listen 前对默认租户跑 ADR-056 引导：upsert `permission_definitions`、超管角色写成 catalog 全码、无 active 超管按 env 创建（或缺则失败）。这是 env 创建，不是引导页。密码登录 HTTP 未做。PUT/PATCH 把超管码改少的写路径锁未做（重启补回）。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官（[裁定 P2 收官后下一步](./13-after-p2-close-order.md)）
- 出口走 L2 归档准出；工程路径 [L2 归档底线](./14-l2-archive-floor.md) 已齐，人签仍图外
- 人签 / 把工程绿写成准出 PASS / 仓库默认打开 rewrite：不进本图执行工单
- P3a 仍等该出口（人签在图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不挡更早语义、不进本回合
- 启动引导切边（引导页 / 密码登录 / role_permissions 终态 / worker 引导）不并进已关工单

候选（来自地图 Not yet specified）：

1. **剩余 P2 半接线**：失败 Webhook、三平面配额、修改日志、在线编写（完整体验 P2.x）、写路径锁超管全码
2. **P3b 尚未齐的强制检索面**：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。
