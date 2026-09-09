# 裁定 Judge AUROC 后下一步

Type: grilling
Label: wayfinder:grilling
Status: resolved
Assignee: grok
Triage: ready-for-agent
Blocked by: 51

## Question

[Judge AUROC 最小闭环](./51-l1-judge-auroc-min.md) 已 `resolved`。独立校准集按 `(score, label)` 算 Mann-Whitney 得 `judgeAuroc`；无打分器或单类为 null；不改 2×2、不进 `signoffEligible`、不新开 `verifier_calib` 入队。仓库默认强制仍关。在线编写仍是 P2.x 留雾。这仍不是人签、不是准出 PASS、不是仓库默认打开 rewrite、不是角色 principal。

裁定 **下一步** 本图走哪条。已锁、不要重开：

- 第三批即本图 P2 语义收官；P2.5 工程路径已齐，人签图外
- 在线编写是完整体验 P2.x
- P3a 仍等 L2 人签（图外）
- LangGraph 重构另起路线
- B8 / B9 / QUAL-2 不进本回合
- P3b 可动手最小闭环已齐；默认开 `DEPT_ACL_ENFORCE`、角色 principal 仍锁
- Hit@k / τ 扫描 / AUROC 切边（逻辑 id 映射 / 写 env / 改签字公式 / 独立 `tau_sweep` 或 `verifier_calib` 入队 / live judge 真跑）不并进已关工单

候选：

1. **P4 余量**：L1 门禁包人签与再认证、多模型 fallback、双轨看板、数据面板增强
2. **在线编写**（P2.x 完整体验）
3. **回头 P3b 余量**（须先解锁站规：默认开强制或角色 principal）
4. **本图暂停执行**，等图外 L2 人签

本工单只锁顺序与切边，不写产品代码。

## Answer

AUROC 之后，**在线编写留雾**（P2.x，不并进）。P3b 余量仍锁（默认开强制会打破 AE3；角色 principal 命名空间仍雾）。**不暂停**等人签。本图继续 **P4**。本批只做 generate 多模型 fallback 最小闭环。

不做再认证流程（源码零钩子，本质图外人签）。不做双轨看板 / 数据面板增强（B6 信封冻结 ≤5；I4 是 P4 建议延后，质量数字已在 `/eval`）。不回头解 P3b 站规。不把 tau* 接到运行时、不写 `TAU_CLAIM`、不新开 `verifier_calib`、不接签字公式、不加 `GENERATE_MIN_NODES`。P3a / 人签 / 准出 PASS / 默认开 rewrite 仍不进执行。

本批一张：

- [generate 多模型 fallback 最小闭环](./53-generate-fallback-min.md) — 开放前沿。绑定已写的 generate `fallbacks` 在 ask 运行时真正切链；primary 同模型重试耗尽后 opt-in 试备用 ModelRef；切到备用才 `fallbackUsed=true`。切边见该工单正文。

仍留雾：仓库默认开强制、角色 principal、在线编写、P4 其余（再认证 / 双轨看板 / 面板增强 / 把 tau* 接到运行时 / live judge 真跑 / 独立 `tau_sweep`·`verifier_calib` 入队）。

未改产品代码。

## Comments

- 2026-09-09 按图顺序认领。用户授权本图全程自行决策。
- Q1：选 1。继续 P4。在线编写留雾。不回头解 P3b 站规。不暂停。
- Q2：本批只做 generate fallback。人签/再认证仍图外。不做双轨看板、数据面板增强。
- Q3：一张工单。快照保留 fallbackRefs → resolve 建成 generate 备用节点 → chat 切链。无 fallbacks = 今日行为。不强制 GENERATE_MIN_NODES。
- Q4：切链发生在 gateway.chat 内（图层仍一次 chargeAndChat）。auth / bad_request / content_filter 不盲切。judge / claim_split / rewrite / embed / rerank 不走 generate 链。
- Q5：默认开强制 / 角色码仍锁。不写 TAU_CLAIM。不改 2×2 / signoffEligible。
