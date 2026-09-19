# 回写三处状态镜像（账本归零）

Type: task
Status: open
Blocked by: 04

## Question

按 [04](./04-dec-mirror-writeback-rules.md) 裁定的口径，把审计（[01](./01-research-ledger-drift.md)）报出的 **25 处「漂移·低估」+ 9 处口径项**逐条回写，使三处镜像与源码零漂移。

回写范围（逐条替换文本已在 `research/ledger-drift.md`「建议回写清单」给全）：

- **`.trellis/tasks/08-06-project-backlog/status.md`**：§2.5.2 十一行状态列与指针（K5 · E4 · E5 · L7 · AA1 · ACL-CAP · TENANT-Q · PLANE · G3 · AB8 · AC7）· 表头计数 · §1.1 L158（P2.5-L3A 口径）· 若裁定需要则增 §0.1 一行新标签。
- **`prds/12-delivery-guides/04-交付控制台.md`**：§0.5 映射表 #1 / #4 / #7 / #8 / #11 / #18 / #22 / #25 / #31 / #32 / #33 · §0.6 · **§0.7 十四行 HALF-\*（全写「未开始」，实为已落地）** · §0.3 · §0.4 P2-L 分母 · §0.2 真跑措辞 · §10.1 变更日志。
- **`docs/module-status/`**：`README.md` 矩阵 L77（「半产品缺口…未做」在该句里被写反）· L78（删去已交付的「admin 设置全量 UI」）· 表头日期戳与入库闭环行 · `api.md` / `worker.md` / `db.md` 的「最近更新」栏与三处「无 `pending_review`」旧边界句。

**不做**：不改 `prds/00–11` 的任何冻结条款（那要 ADR → PRD → 升版本）；不为凑数抬 `docs/module-status` 的成熟度标签；不动源码。

## Answer

（进行中）
