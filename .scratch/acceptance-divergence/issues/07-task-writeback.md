# 回写：镜像 / 覆盖表 / 规范 + 收口门禁

Type: task
Status: claimed（主控 2026-09-24 认领；回写子代理执行）
Blocked by: 03-task-ask-divergence · 04-task-ingest-divergence · 05-task-acl-divergence · 06-task-ops-divergence

## Question

把工单 03–06 的裁定与落地写回三处镜像，并跑收口门禁。

1. **`docs/testing/coverage/` 四册**：16 行的「缺口」列**没有一行**还是「源码侧待定」；每行写成「**已裁定**：<归属> · 依据 <PRD 措辞 + 源码锚点> · 收口 <动作 / 阻塞方>」的统一形态。覆盖值按裁定重判（`已测` / `部分测` / `缺实现` / `延后`）。
2. **`docs/testing/coverage.md`**：
   - 末段那张「源码与 Then 不一致或源码无落点 16 行」清单**按裁定改写**（不再说「源码侧待定」，改为「已裁定，逐行见分册」）；
   - 四册的**计数与合计**若因重判而变化，汇总表与分册行级数字必须**同时**改，并用**脚本按行求和**核一遍（`docs/testing/coverage/03-ops.md` 顶部已有加式先例）；
   - 追加「第九轮」叙述（本轮：四册哪些行改判、为什么、改了哪侧），口径与既有八轮一致（「判据来源一个字未改 —— PRD 门限与字段表没动，改的是『代码有没有真按它判 / 报告里能不能读出判据』」）。
3. **`docs/module-status/<包>.md`**：凡本次**源码**有改动或**债有增减**的包，按 skill `update-module-status`（先读源码再改文，禁把 task 叙事当证据）回写；遵守纪律：正文**不写 `路径:行号`**、不给裸标识符加反引号。
4. **`.trellis/spec/<包>/`**：凡本次定下的**新纪律**（如「订正覆盖表口径必须同时补钉住那一支的测例」、裁定书放哪、哪几条属 ADR-ready）写进对应包规范或共享指南。
5. **收口门禁**（必须在**最后一次提交之后**跑）：
   - `pnpm check-types` · `pnpm lint`（零 warning）· `pnpm build`
   - `pnpm run test --concurrency=1`（串行；并发下 `@strict-rag/web` 会假红）
   - `pnpm check:module-status` → 基线 **39 条 = 2 env + 13 符号 + 24 表**，且 `1-路径` / `6-联动` / `7-时效` **全空**
   - `git status --short` 干净
6. **对抗性反向复核**：逐条核「这话在源码里真能指到吗」——把每一行新写的覆盖表结论与对应源码 / 测例对一遍；抓到不符就改结论，不许留。

纪律：**不许**改 `prds/*`；**不许**为了凑合计去改行数；加式必须脚本核过。

## 产出

- 镜像 / 覆盖表 / spec 改动（可提交的 diff）+ 门禁输出证据。
- 本工单 `## Answer`：门禁结果逐项 + 反向复核抓到的问题与修法 + 一条「本轮口径教训」。

## Answer

1. **`docs/testing/coverage.md`**：汇总表按增量改（ask 26/25→**30/21** · acl 56/8→**58/6** · ops 40/19→**41/18** · ingest 不变；合计 156/66→**163/59**，行数仍 **280**）；脚本按行机械核 → **0 处不一致**（每册两数相加=该册行数 · 各册行数相加=280 · 各覆盖值列相加=合计列）。末段 16 行句整体改写为「**已由 wayfinder 图 `acceptance-divergence` 逐行裁定**（已测 7 · 保留 `部分测` 9）……**不再有「源码侧待定」**」；另把 `「行级合计 65 行」→ 59`（该数自第八轮加 L2 起即滞后于汇总表）、把「当前保持 `部分测` 的行」段的 acl 名单去掉 `S4`/`X4` 并把「S1/S4/Y6/X4/X5 为源码侧待定」改写为 S1/Y6=乙(实质)+债、X5=丁(真 ES)；**新增第九轮叙述**（判据来源一个字未改 · 唯一一处源码改动 = route source 取值域对齐 ADR-033 · 1 新文件 + 5 新 `it` · 四册改判 · 9 行真债逐条点名）。该文件里其余行内的既有轮次叙述与其它行未动。
2. **`docs/module-status/`**：`api.md` 补 route source 取值域债（含「本镜像曾零记载」+ 爆炸面 + 后置禁词支不可达属**非缺陷**）与 3 条债（V5 无重提端点 · X4 空白名单放行**非缺口** · T6 无运行时加载口撞 ADR-007），并给「纯规则路由」一句补取值域事实；`worker.md` 补 M8 审计 sink 债 + R9 入库 embed 零打点债；`admin.md` 补「壳准入只认 admin.shell + **无服务端硬拦截**」债，并给「鉴权外壳」节加事实句；`README.md` 鉴权/ACL 与观测/评测两行各同步一句。四文「最近更新」均写 **2026-09-24**；正文**不写** `路径:行号`、**不给裸标识符加反引号**（用「route source 取值域」这类描述性写法）。
3. **`.trellis/spec/`**：`guides/testing.md` 新增 **§1.2 覆盖表口径订正纪律**（三条：① 先判措辞、许可/析取≠义务 ② 订正口径**必须同时补钉住那一支的测例** ③ **冻结契约缺口**须量爆炸面并声明「行为可见的契约对齐」）+ 缺口列定型写法 + ADR-ready 不落 PRD；`api/backend/index.md` 新增「ADR-ready 裁定指针」一行指向 `research/02-adr-ready-findings.md`。
4. **`research/02-adr-ready-findings.md`（新建）**：八条裁定书（现象 · 冻结依据逐字 + 行号 · 为何本图不动 · 改动路径 ADR→改 PRD→升版 · 若走实现路的爆炸面）+ 一览表 + 收口说明。
5. **反向复核**：逐条把覆盖表结论对回源码/测例。**重点核项全部命中**：`00-ask.md` `D-拼句` 的 `apps/api/src/graph/route-rules.ts:6,71,80,90` 确实依次在**类型声明 / 后置禁词支 / 寒暄支 / 知识向支**；`02-acl.md` `S4` 的 `role-templates.ts:19`（`DOC_OPERATOR_CODES` 首项即 `admin.shell`）、`:24`（`KB_ADMIN_CODES` 声明、展开在 `:25`）、`role-hydrate.ts:111`（`defaultCodesForRoles(claimsRoles)`）**均支持该结论**。另核 16 条 PRD 行号（`:83 146 154 208 260 307 320 323 344 365 380 415 479 543 544 572`）与 `adr-index.md:402/1344` **逐字一致**；H1/R9/T6/P3/AC2/X4/X5/M8/V5 的源码锚点与 `it` 名亦逐一命中。**抓到 1 处不符（在 issue 不在分册）**：`05-task-acl-divergence.md` 的 Answer 写 S4 新 `it` 在 `auth-guard.test.tsx:107`，**实际在 `:106`**（S1/Y6 的 `:79` 正确）—— 按纪律**不改分册、不改 05 票**，在此报告由主控定夺。
6. **门禁（原始数字）**：`pnpm check-types` → `Tasks: 8 successful, 8 total`（exit 0）· `pnpm lint` → `Tasks: 8 successful, 8 total`（`--max-warnings 0`，**零 warning**，exit 0）· `pnpm build` → `Tasks: 8 successful, 8 total`（exit 0）· `pnpm run test --concurrency=1` → `Tasks: 11 successful, 11 total`（首跑 **`Cached: 11 cached`** ⇒ 追加 `--force` **真跑**：**`Cached: 0 cached, 11 total`**，exit 0；db 11/31 · contracts 34/283 · admin-catalog 1/13 · worker 56/251 · web 19/56 · api 177/1099+3skip · admin 38/187；四个 app 存货闸 `# tests 8 / # fail 0`）· `pnpm check:module-status` → **`漂移报告 · 39 条`** = `2-env（2）· 3-符号（13）· 5-表（24）`，`1-路径`/`4-端点`/`6-联动`/`7-时效` **全空**（命中基线 · 39 = 2+13+24）· `git status --short` 只有本 Answer 所列 9 个文件。
7. **本轮口径教训**：覆盖表的「缺口」列一旦写成短语（「源码侧待定」/「待补测」），就会把**三类完全不同的东西**（Then 是许可 · Then 引了不存在的面 · 源码真缺）压成同一句话，下一张图只能重头再判 —— **口径订正的成本主要在识别，不在改字**；故本轮把定型写法 + 三条纪律固化进 spec，并要求每条记债必须写清**销账条件**。
8. **我改了哪些文件**（9 个，全是 docs / spec / scratch，**未动**源码 · 测例 · `fixtures/` · `prds/` · `map.md`，未建分支 / 未 commit / 未 push）：`docs/testing/coverage.md` · `docs/module-status/README.md` · `docs/module-status/api.md` · `docs/module-status/worker.md` · `docs/module-status/admin.md` · `.trellis/spec/guides/testing.md` · `.trellis/spec/api/backend/index.md` · `.scratch/acceptance-divergence/research/02-adr-ready-findings.md`（新建） · `.scratch/acceptance-divergence/issues/07-task-writeback.md`（本 Answer）。
