# 现状核实：ask 的租户取值链全图与「两源不等」的可达性

Type: research
Status: pending
Blocked by: —

## Question

把「ask 在检索期认哪个租户」这件事**逐条落到源码、PRD 与测例事实**，好让裁定票能拍板（不发明语义、不写建议）。每条结论**指到路径 + 行号**，并区分「源码事实」与「推断」。**只读**，不改任何源码 / PRD / 文档 / 测例。

1. **租户取值链全图（本图的事实底座）**
   - 从 HTTP 入口到检索返回，逐段列出**每一个** `tenantId` 的：来源（谁的字段 / 哪个常量 / 哪个请求体字段）· 传递路径（file:line）· 消费点（做什么判定或过滤）。
   - 至少覆盖：`routes/ask.ts`（用户路径）· `routes/eval.ts` 的 `/internal/eval/execute-ask`（内口路径）· `services/ask/execute.ts` · `services/retrieve/{retrieve,types,corpus,visibility,es-sparse}.ts` · `apps/worker/src/ingest/pipeline.ts` 的 ES bulk 写入 · `apps/worker/src/eval/execute-ask-http.ts`。
   - 明确回答：**全仓一共几个「租户权威源」？**（入口 = `auth.tenantId ?? kb.tenantId`；装载 = 文档行第一行；ES 写入 = `doc.tenantId`；ES 查询 = 入口；内口 = 请求体）逐一指到行号，不要合并同类项。
   - `documents.tenant_id` 的**所有写路径**列出来（含 `complete` / 在线编写 `documents/write` / 上传 / 评测语料入库脚本），核每条写的是 `kb.tenantId` 还是别的值；有没有任何路径能写出与所属 KB 不同的租户。
   - `chunks` / `chunk_embeddings` / ES bulk 的 `tenantId` 来源逐个核（是否**全部**来自 `doc.tenantId`）。

2. **可达性：`auth.tenantId ≠ kb.tenantId` 今天能造出来吗**
   - `auth.tenantId` 的最终来源：JWT claim 由谁签发（`routes/auth.ts` 的 dev-login / 内口 / 其它）· 值取自哪一行（`users.tenant_id`？）· refresh 续签时会不会变。
   - `kb.tenantId` 的来源：`createKb` 写的是什么；有没有别的建库入口。
   - **逐条列出能把两者造不等的路径**（例如 `/web/dev-login` 请求体显式 `tenantId` + 超管绕过成员资格；跨租户邀请成员；直接改库）。每条给出**最小复现步骤的形状**（不要真跑生产）。
   - **生产档位**（`APP_ENV` 非 development / test）下这些路径还通不通？`apps/api/src/env.ts` 与各路由的守卫逐条核。
   - **客户端会不会传** `tenantId`：`apps/web` / `apps/admin` 的登录调用有没有该字段；若没有，`auth.tenantId` 在真实客户端下是否恒为 `DEV_DEFAULT_TENANT`。
   - 结论层：给出「**今天可达 / 只在 dev 可达 / 结构上可达但无触发面**」三态里的一态，并说明判据。

3. **PRD / ADR / 剧本：租户权威源的原文与沉默**
   - 逐条给出含「租户 / tenant / 跨租户 / 多租户」的**冻结原文 + 行号**：`prds/09-security/01-auth-acl-compliance.md` · `prds/03-data/`（各存储的租户列与边界）· `prds/05-api/01-http-api-hono.md`（ask / 内口 / 建库 / 邀请成员）· `prds/04-pipelines/`（检索两侧）· `prds/10-delivery/03-acceptance-scenarios.md`（**AE8「ES 收窄与 PG 语料同源」**的原行原文）。
   - 特别核：有没有任何一处**写明**「ask 的租户以哪个为准」？如果没有，**如实写「PRD 沉默」**并给出你搜过的关键词与文件清单（避免「我没找到」被读成「不存在」）。
   - ADR 侧：`prds/11-decisions/00-adr-index.md` 里 ADR-041（独立索引 / filter 强制）· ADR-051（授权 SSOT）· ADR-057（可见性同函数）里与租户相关的条款原文 + 行号；有没有条款规定了「租户必须一致」或「不一致怎么办」。
   - 结论层：本议题属于「PRD 有明文」还是「PRD 沉默 / 只有实现选择」？逐条给依据。

4. **既有断言盘点：改任一侧会翻哪些测例**
   - `apps/api/tests/acl/dept-acl-ask-e2e.test.ts` 的 `describe('语料装载的 tenantId 来源（fail-closed）')` 与 `describe('runRetrieve 的 ES 收窄与 PG 语料同源（AE8 对称）')` 逐条列出断言原文 + 行号 + 它钉住的到底是「哪个源」。
   - 全仓再搜一遍：还有哪些测例（api / worker / contracts）断言过 ask 或检索的 `tenantId`（含 `expect(...).toBe(TENANT)`、fixture 里的 `tenantId:` 常量、`requireTenantId` 的报错断言）？逐条 file:line。
   - 逐条给出**反向影响表**：若把 ES 查询腿改成 `kb.tenantId` → 哪些断言会红？若把装载面改成入口租户 → 哪些会红？若「不等即拒」→ 哪些会红？哪些**不会**红（因为两侧传的是同一个常量、或 mock 忽略入参）？
   - **测试基建事实核实**：装载测例里 `db.js` 的 `where` 是不是被 mock 成忽略入参（前图结论，请独立复核并给出代码行）？全仓有没有任何夹具造过「文档行租户 ≠ 入口租户」？

5. **候选处置的代价面（为裁定票准备，不替它选）**
   - 把三条候选（① ES 稀疏腿改按 `kb.tenantId` ② `auth.tenantId ≠ kb.tenantId` 即拒 ask ③ 明确「跨租户访问不得发生」并在写路径 / 读取面加断言）逐条写成：**改动点（file:line）· 会翻的断言 · 回归面（波及哪些包 / 测试）· 是否与「门禁只加严不放宽」一致 · 是否需要 ADR（改的是不是既有语义）**。
   - 第四条候选：**只加断言、不改判据**（例如在 ask 入口对两源不等时打点 / 拒绝 / 告警）—— 它的可行性、会不会改变现有行为（逐位等价吗）、以及它是否真的能让「静默丢失」不再静默。
   - 明确：三条（或四条）里哪几条**必须动 `prds/00–11`**、哪几条可以「源码收紧 + 记 ADR 债」收口。给判据，不要给结论。

6. **邻接缺口核实（不修，只判性质）**
   - `routes/members.ts` 的 invite 路径：成员行 `tenant_id` 取的是谁的值？全仓有没有「目标用户必须与 KB 同租户」的校验（含 DB 约束）？`isMember` 查询按不按租户过滤？
   - `kb_members.tenant_id` 全仓**有没有消费者**（任何 WHERE / 判定 / 读面）？逐条 file:line；没有就写「无消费者」。
   - `corpus.ts` 取 `dual[0]?.tenantId`（**第一行**）：如果同一 KB 下文档行租户不一致会怎样（逐条推演：可见性上下文取到哪一行的值、其余行的后果）？今天有没有路径能造出这种不一致？
   - `documents.tenant_id` 的 DB 约束现状（NOT NULL？外键？CHECK？）—— 指到 `packages/db/src/schema/kb/documents.ts` 与迁移文件。

7. **真栈可用性（实测，不推断）**
   - 今天本机能不能起 Docker / 真 PG / 真 ES？（给出你**实际执行**的命令与结果，不要凭前图口径。）若能：真 ES 上把「ES 文档租户 = A、查询租户 = B」的最小对照跑出来（写入 2 条不同租户的稀疏文档，分别用 A / B 查，看命中数），给出实际数字。
   - 若起不来：如实写「未实测」并说明阻塞点。

8. **既有文档与镜像现状**
   - 相关 spec（`.trellis/spec/api/backend/` 下检索 / 鉴权 / 计分相关文件）里今天怎么描述租户来源？逐条给出文件 + 原文（若描述与源码不符，指出不符）。
   - `docs/module-status/api.md` 里簇 40 那条技术债行的**原文**，以及有没有别处也提过该债。
   - `docs/testing/coverage*.md` 里 AE8 相关行的当前值（`已测` / `部分测` / `缺实现`）与缺口文字。

## Answer

<!-- 关闭本工单时回填：逐组结论 + 每条指到 file:line；标出「源码事实」与「推断」；最后给一节「推翻了什么前提」 -->
