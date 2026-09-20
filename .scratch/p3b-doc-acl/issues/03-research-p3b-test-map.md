# 研究：B2 / AE 剧本的测例级缺口与最小可断言形态

Type: research
Status: claimed
Blocked by: —

## 问题

P3b 出口要求「B2 + AE（强制段）绿」。镜像已记（`docs/testing/coverage/02-acl.md:39-47`、`:109-121`、`:160`）：B2-1 / B2-2 / B2-3 部分测；AE4–AE8、AE10–AE12 全为部分测（默认关、无 ask 端到端）。需要落到**测例级**：

剧本原文在 `prds/10-delivery/03-acceptance-scenarios.md`：B2-1 `:53` · B2-2 `:54` · B2-3 `:55` · B2-4 `:56` · AE4 `:520` · AE5 `:521` · AE6 `:522` · AE7 `:523` · AE8 `:524` · AE10 `:526` · AE11 `:527` · AE12 `:528`。

## 要回答

1. **逐行**给出现有测例的**文件 + 用例名**（不是 index 叙事，也不是 spec 描述），并判定该行 Then 是否已被断言；未断言的差额写清。
2. 每条未断言的缺口给**最小可断言形态**：夹具（内存仓库 / mock gateway / 注入 env / KB `config_json` 覆盖）、断言层级（HTTP 还是检索层）、以及在**不改仓库默认开关**下让强制生效的具体做法（先例：`apps/api/src/services/retrieve/dept-acl.ts:8` 每次调用现读 `process.env`，便于 stub；KB 覆盖入口 `apps/api/src/services/kb-settings.ts:200-212`）。
3. 标出哪些缺口**必须真 ES 集群**才能断言（不要把这类写成「可做」）。
4. 每条给**反证方式**：破坏哪一处代码会让该测例变红（用于证明测例真的在测）。

## 约束

- 只读，不改文件、不跑测试（读测例文件即可）。
- 结论要能直接支撑决定票 `07-dec-acl-tighten-reindex.md` 与实现票 `11-task-b2-ae-tests.md`。

## Answer

（待填）
