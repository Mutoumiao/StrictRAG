# 裁定末位超管前端提示后下一步

Type: grilling
Label: wayfinder:grilling
Status: open
Triage: ready-for-human
Blocked by: 20

## Question

[末位超管前端提示](./20-last-superadmin-hint.md) 已 `resolved`。本批鉴权/成员余量（[鉴权路径与成员 PUT](./19-authz-path-and-member-put.md) → 末位超管前端提示）已齐。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是启动引导超管页。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官（[裁定 P2 收官后下一步](./13-after-p2-close-order.md)）
- 出口走 L2 归档准出；工程路径 [L2 归档底线](./14-l2-archive-floor.md) 已齐，人签仍图外
- 人签 / 把工程绿写成准出 PASS / 仓库默认打开 rewrite：不进本图执行工单
- P3a 仍等该出口（人签在图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不挡更早语义、不进本回合
- API 最后超管 400 闸不放宽（已由末位超管前端提示钉死）

候选（来自地图 Not yet specified）：

1. **剩余 P2 半接线**：入库报告、失败 Webhook、三平面配额、修改日志、超管引导页、在线编写（完整体验 P2.x）、库选择器只列成员库
2. **P3b 尚未齐的强制检索面**：ES 查询期对称、aclPrincipals 全文、敏感解禁、仓库默认开 `DEPT_ACL_ENFORCE`
3. **P4**：L1 门禁包签字与再认证、多模型 fallback、双轨看板、数据面板增强
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。
