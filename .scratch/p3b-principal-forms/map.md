# P3b 主体形态的口径闭合（`aclPrincipals` 的 `user:` 语法 vs 结构化等价形态）

Label: wayfinder:map
Status: resolved（前沿：空；工单 01 · 02 · 03 全收口）

## Destination

让路线图 Phase 3b 出口里**唯一还剩的工程侧争议**——ADR-057 §5 要求的「用户主体集合」形态——在本分支闭合到**可核对**，且**不接真 ES、不改仓库默认开关、不动 `prds/00–11`**：

1. **口径落定**：ADR-057 `prds/11-decisions/00-adr-index.md:1861-1864` 要求主体集合「至少含 `user:{id}` 与 `dept:{deptId}:lv:{effectiveLevel}`」，而同一节 `:1865` 又写明「文档/chunk 反范式 `aclPrincipals`（**或等价结构化字段**：`owner_dept_id` + `visibility_level` 由检索层展开为可匹配条件）」。本仓今天走的是**后一条等价形态**（部门轴用 `ownerDeptId` + `visibilityLevel` 在检索层展开；用户轴用不带前缀的裸 uuid 名单）。要裁清：这条等价是否**已经**满足 ADR-057 §5，还是仍欠一个「身份展开器」。
2. **按裁定落地**：裁定为「已满足」→ 补一份可引用的裁定 + 把镜像 / 覆盖表里所有「**≠** 角色 principal」的欠债句改成准确口径（含它们各自的真实边界）；裁定为「仍欠」→ 落最小身份展开器（PG 谓词 + ES 入参与查询期 + 契约 + 测例），并保持**只加严**。
3. **B2-2 的判据归位**：`docs/testing/coverage/02-acl.md` 的 B2-2 行今天挂「角色码 principal 未做，只能作等价替换」。裁定后该行要么转 `已测`（缺口只剩须真 ES 的半截），要么把缺口写准（缺的是哪一截、为什么不能离线）。

到达时兼满足：`pnpm check-types` / `pnpm lint` / `pnpm test` 全绿；`pnpm check:module-status` 的 1-路径 / 6-联动 / 7-时效 三类为空；覆盖表计数与行级重数一致。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11`（当前 0.4.32）为准；**IS 以源码为准**，`docs/module-status/` 是镜像，`docs/testing/coverage/` 是派生对照。
- **前图**：[`p3b-doc-acl`](../p3b-doc-acl/map.md)（已收口，前沿为空）。它把「同一可见性函数」「dense∥ES 对称」「ES 查询期与 PG 谓词对称」「剧本 B2/AE 自动化断言」「ACL 收紧的索引一致性」五件事全部落地并回写，只把「主体形态」留在雾里转给本图。
- **每轮先读**：本图 · `docs/agents/issue-tracker.md` · `docs/agents/domain.md` · 前图 `map.md` 与相关工单 Answer · `docs/testing/coverage/02-acl.md`。写代码前读 `.trellis/spec/api/` 对应包 `index.md` 与 `backend/departments.md`。
- **本图携带执行**：工单可以直接改代码、补测例、回写镜像，不只锁决策。同一缺口**禁止**再 `task.py create` 平行实现任务。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口跑全仓 `pnpm test`。测例只进 `<包>/tests/<能力>/<意图>.test.ts(x)`，文件头「目标 / 需求 / 被测 / 简介」必须简体中文，并登记该包 `tests/index.md`。
- **不改仓库默认开关**：`DEPT_ACL_ENFORCE` / `DEPT_INHERIT_DOWN` / `AUTH_ENFORCE` / `RETRIEVE_ES_MODE` / `INGEST_ES_MODE` / `SESSION_REWRITE_ENABLED` / OCR 的默认值一律不动。开强制靠 **KB 覆盖或测例内注入**。
- **不改 `prds/00–11`**：任何「与 PRD 字面不一致」只能以「源码收紧 + 记 ADR 债」收口；销账须 ADR → 改 PRD → 升版本。**本图的前提判断**：PRD 05 §2.4 只列了两个端点、**未规定**名单字段的语法，故 `user:` 前缀属**契约层**决定，不是改冻结语义（该判断本身要由工单 01 核实）。
- **质量红线不放宽**：检索→约束生成→验证→拒答；min 否决；合法 draft 必 verify；历史≠evidence；**门禁只加严不放宽**；双就绪∧active 检索闸。数据面的可见集合**只允许收紧或逐位等价**。
- **本机限制**：无浏览器验证手段 → web / admin 视觉改动不在本图；真 ES 集群 / 真 PG 迁移 / 人签也不在。
- **前图教训（两条，本图必守）**：① 收口声明必须在**最后一次提交之后**复跑 `pnpm check:module-status`；② 回写要带**对抗性反向复核**（正向审计查不出「把验证发生在哪写错」）——即每处回写都要逐条核「这话在源码里真能指到吗」。

### 开工基线（2026-09-21，前图收口时）

| 处 | 今天的样子 |
|---|---|
| DB | `packages/db/src/schema/kb/documents.ts` 的 `aclPrincipals`（可空 text 数组） |
| 契约 | `packages/contracts/src/ingest/document.contract.ts` 的 `PutDocumentAclBodySchema`（uuid 数组；非 uuid → 400，已有测例锁死） |
| PG 谓词 | `apps/api/src/services/retrieve/doc-acl.ts`：`principals.includes(userId)`；缺字段=成员可读、`[]`=不可读 |
| ES 侧 | `es-sparse.ts` 的 `aclPrincipalsFilterClause(userId)`：should = `must_not exists` ∪ `term aclPrincipals: uid`；worker `es-http.ts` 的同名近似拷贝写 bulk |
| 部门轴 | **已走等价结构化形态**：`ownerDeptId` + `visibilityLevel` 由检索层展开（`collectVisibleOwnerDeptIds` + `maxVisibleLevelUpperBound`） |
| 镜像欠债句 | `docs/module-status/api.md` · `contracts.md` · `docs/testing/coverage/02-acl.md` 多处写「**≠** 角色 principal」 |

## Decisions so far

- [主体形态今天在契约 / PG / ES / 测例各处是什么](./issues/01-research-principal-forms.md) — 研究子代理产出（7 节，逐条要么指到源码行、要么指到 PRD/ADR 行）。要点：① `user:{id}` / `dept:{id}:lv:{n}` 是 ADR-057 §5 `:1862-1864` 的**必达**，`role:…` **不是**（只在 ES PRD `:75`（带「等」）· `:114` 示例 · 安全 PRD `:210`（带「等」））；② PRD 05 §2.4 `:231-235` 逐字只有两个端点、**全文不含 `aclPrincipals`** → 改元素语法属**契约层**决定；③ 全仓**没有一处**支持前缀形态；PG 列是 **`uuid[]`**（改前缀须迁移）；④ 用户轴与 `user:{id}` **可读集合逐位一致、只差记号**；部门轴的枚举形态**无法**表达 `≥` / 上级看下级 / grant 子树 / 库级四条规则，故 §5 `:1865` 的等价结构支才是本仓该走的那支；⑤ 本票前提纠错两处：`contracts.md` 里**没有**「≠ 角色 principal」句（0 命中）、仓内 ES 稀疏入参形状与 ES PRD §4.5 的 `userPrincipals?: string[]` 声明确实不符（前提遗漏项）。
- [裁定：ADR-057 §5 的「或等价结构化字段」是否已被满足](./issues/02-dec-principal-form-ruling.md) — **部门轴已满足**（走 §5 `:1865` 明文许可的等价结构化支，四条规则逐条兑现；反过来枚举支无法表达它们）；**用户轴语义已满足、记号未对齐**；**`role:…` 非必达且实现它属放宽方向**；**本仓选择不实现前缀记号与 role 主体**（理由：前缀须 `uuid[] → text[]` 迁移 + 写入口元素形状放宽，收益为 0；role 属放宽，撞「门禁只加严不放宽」）。裁定**不宣告「已对齐冻结文本」**，而是把三处偏离记为**带销账路径的债**（ADR → 改 PRD → 升版本，或实现路径）；**不改 `prds/00–11`**。
- [落裁定的形态（镜像 / 覆盖表 / spec 回写）](./issues/03-task-land-ruling.md) — 纯回写、**无代码改动、计数一行未变**：覆盖分册 `02-acl.md` 加「主体形态（裁定）」口径条 + B2-2 缺口列去掉「ADR-057 要求角色 principal」的**错误归属** + 文末债改成**三条偏离各自带销账路径**；`api.md` 7 个「≠ 角色 principal」→「≠ role 主体」+ 技术债表新增「主体形态」行 + 把**过宽**的「ADR-057 全文未上」收紧为「等价支与同一可见性函数已落，未上的是枚举支记号 / role / 强制默认开」；`README.md` · `admin.md` 同款；`contracts.md` 补「元素形态是契约层决定」+ 指针；spec `departments.md` 新增 §2.1「主体形态的口径」+ 写这类改动的硬约束。**对抗性反向复核**逐条做了（每句话都能指到源码/原文；「写前缀会以何种错误失败」是推断、已按推断口径写）。核实：`pnpm check:module-status` **39 条 = 2 env + 13 符号 + 24 表**，`1-路径` / `6-联动` / `7-时效` **全空**。

### 目的地达成（2026-09-21）

路线图 Phase 3b 出口里最后一条工程侧争议（主体形态）**已闭合到可核对**：判据是「§5 的两支各由谁承担、源码在哪、哪一支不可互换、哪三处是真偏离、各自的销账路径是什么」，全部有源码 / 原文出处。**结论是「不实现」而不是「已对齐」**——这是本图最有价值的产出：它把一条长期被含糊写成「ADR-057 要求角色 principal 未落」的欠债，拆成一条**归属错误**（role 非必达）、一条**只差记号**（可读集合逐位一致）、一条**属放宽方向故保守不做**，并明确销账路径。**前沿已空**。

## Not yet specified

- **`CorpusLoader` 的 tenantId 接口缺口**（前图雾中项的原样转来）：`RetrieveInput.tenantId` 已有但 `CorpusLoader` 签名未传，检索侧只能从文档行反推 tenantId（fail-closed 方向）。修它是纯工程，但会让 `loadCorpus` 的所有夹具改签名，属回归面较大的独立小图；要不要在本图顺手收，看工单 01 的回归面测算。
- **`DEPT_INHERIT_DOWN` 关继承时「库级文档」的语义**：`collectVisibleOwnerDeptIds` 在关继承时只精确匹配；PG 对无 `ownerDeptId` 的文档独立给了级别规则（任一处负责人 30，否则 20），但「关继承」是否影响库级文档 PRD 未明说。本仓按「不影响」实现。须 PRD 补行才能销账，可能属**改冻结语义**（须 ADR）。
- **grant 写审计是否落表**：今天只有 Pino（`routes/dept-grants.ts` 的 `dept_cross_grant_*` + 中间件的 `admin_write`），AE7 的 Then 写「审计有记录」，ADR-057 也写「审计」。落表要先裁「Then 是否要求表级证据」。
- **`loadVisibilityContext` 要不要挂请求级缓存**：可省掉「详情 + ACL 名单」同请求内的重复加载，但会引入请求内失效语义。待有性能证据再议。
- **PRD 阈值公式缺失**（前图 out-of-scope 点名要另图）：PRD 写「近指代主题正确且合法作答 ≥ 80%」，而判定公式只看零容忍命中与九类覆盖、不看 pass/fail 比 → 「**门禁比 PRD 松**」的疑点。它比本图目的地更靠后，且可能要求改 `prds/08-quality`（须 ADR）。
- **ES PRD 提到的 `role:…` 主体**：ES PRD 的字段表把 `aclPrincipals` 描述为「可见主体（`user:…` / `role:…` / `dept:…:lv:…` 等）」，而 ADR-057 §5 的必达清单只点名 `user:` 与 `dept:…:lv:…`。`role:` 是否属必达待裁。

## Out of scope

- **真 ES 集群 / 真 PG 迁移 / 人签**：不可离线核对。
- **改仓库默认开关**（如 `DEPT_ACL_ENFORCE=true`）：须 ADR → 改 PRD → 升版。
- **改 `prds/00–11` 已冻语义**。
- **admin / web 的视觉与交互改动**：本机无浏览器验证手段。
- **P3a Full 图（CRAG / multi_hop）与 P4/P5**：另图。
- **敏感语料入池**：路线图明写「此后方可讨论」。
