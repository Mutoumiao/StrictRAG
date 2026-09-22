# 回写镜像 / 覆盖表 / spec + 收口门禁

Type: task
Status: open
Blocked by: 03, 04, 05

## Question

把本图三张落地票的成果回写成**可核对的镜像**，并收口：

- **镜像**：`docs/module-status/api.md` · `worker.md` · `contracts.md`（+ 若新增表则 `db.md`）——按源码写「已具备 / 未做 / 技术债」，新增的债写**销账路径**，并更新「最近更新」日期。**不写 `路径:行号`**，不给裸枚举字面量加反引号。
- **能力矩阵**：`docs/module-status/README.md` 的「观测 / 评测」行若成熟度措辞变化则增量回写（矩阵只写一句话，不展开）。
- **覆盖表**：`docs/testing/coverage/03-ops.md` 与 `docs/testing/coverage.md` 里 C3（Judge AUROC）等相关行按新事实改写；**行号若失效要同步**；若某行 coverage 值变化要如实改，没变要写明「只改证据不改值」。
- **spec**：`.trellis/spec/api/backend/l1-eval.md`（+ l2 若涉及）补「人工抽检登记面」「打分器来源三态」「§8 可复现区块」三节，写清禁则。
- **backlog 指针**：`.trellis/tasks/08-06-project-backlog/status.md` 里相关行（B10-followup 的签字余量、§2.5 QUAL 若涉及）如实更新；**不**改交付控制台以外的对外话术。
- **对抗性反向复核**：逐条检查「写进镜像的每句话在源码里真能指到吗」，把复核表写进 Answer。
- **收口门禁**（**在最后一次提交之后**复跑）：`pnpm check-types` · `pnpm lint`（零 warning）· 全仓 `pnpm test`（**无并发**）· `pnpm check:module-status` 的 `1-路径` / `6-联动` / `7-时效` 三类为空。数字写进 Answer。

## 交付

- Answer 里给：回写表（文件 → 改了什么）· 对抗性复核表 · 未解决项 · 门禁数字。
- 若发现**镜像里已被本图改假**的旧句子，一并纠正并在 Answer 里点名。
