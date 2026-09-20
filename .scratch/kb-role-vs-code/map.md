# KB 内 role 与权限码的竞合：冻结条款对账与去向

Label: wayfinder:map
Status: resolved（前沿：空。裁定 = **KB 内授权判据为「权限码 + KB 成员资格」，`kb_members.role` 不参与运行时闸**；role 条件条款记为**须 ADR 销账的文本债**；未改源码、未改 `prds/00–11`）

## Destination

对「**KB 内的 `kb_members.role`（read / write / admin）是否参与授权闸**」这条雾给出**有原文可引用**的裁定，并把裁定落到**可核对的去向**——要么源码补闸（只加严），要么回写镜像并把它记成需 ADR 的冻结核查债。到达时同时满足：

- **条款对账闭环**：`prds/00–11` 中每一处「按 role / 按 read|write|admin 能力」的授权条款都被逐条列出（文件:行 + 原文 + 生效版本 + 是否被后续 ADR 修订），**没有**任何一条既未落地又未被判定为已被取代。
- **源码实况可核对**：每条相关路径给出「role 参与 / 不参与」的实证（符号 + 行号），不靠推断。
- **不擅改冻结文本**：`prds/00–11` 一个字不改；若结论是「条款仍在而源码缺」→ 补源码；若结论是「已被 ADR-051 取代」→ **不**改 PRD，只在镜像侧记明「条款与现行判据不一致，须 ADR 才能在 PRD 侧销账」。
- **不翻转仓库默认**：`AUTH_ENFORCE` / `DEPT_ACL_ENFORCE` / rewrite / OCR 等默认值一律不动。

## Notes

- 域：StrictRAG。**WHAT** 冲突以 `prds/00–11` 为准；**IS 以源码为准**，`docs/module-status/` 是它的镜像。
- **前图**：[`doc-read-member-gate`](../doc-read-member-gate/map.md)（已收口）。它把 `kb_members.role` 列进 Out of scope 并作为雾转出，本图就是那条雾；覆盖表 `02-acl.md` 的 **S5** 行也记着同一截（「成员角色粒度」）。
- **触发本图的两处硬冲突（已核原文，非笔记转述）**：
  - **ADR-045 §决策 2 焊死 #1**（`prds/11-decisions/00-adr-index.md:959`）：「纵深：各 admin **API handler** 仍按 ADR-035 矩阵校验 `kb_members.role`（中间件漏了也不放行写）。」
  - **ADR-045 §决策 2 焊死 #3**（`:965`）：「**操作权限（KB 级）**：对某 KB 的写仍按该行 role；read-only KB 写操作 **403**。」
  - 与之对立的 **ADR-051 §决策 2**（`:1352`）：「授权 SSOT = permission code……运行时 **以有效码为准**；`platform_role` / `kb_members.role` 为 **模板锚点**。」§决策 9 否决列（`:1366`）：「无码只靠 role 字符串」。
  - **版本先后**：ADR-045 = 0.4.19（`:984`）；ADR-051 = 0.4.25（`:1370`）。ADR-051 的「修订关系」（`:1341-1346`）只点名修订 ADR-035 的「`platform_admin` 不隐式全权」、ADR-049、**ADR-045 的壳准入**——**未提及** ADR-045 焊死 #1/#3 的 role 句。故两条款在文本上**同时有效**，冲突未被任何一方销账。
- **另两处点名的 role 条件条款**：
  - ADR-035 §决策 5（`:505`）：「read = 消费者（ask、文档元数据列表、提交 feedback）；不能上传/删文档/成员/config/评测。」
  - ADR-035 §决策 7（`:511`）：「**删文档**：write 可删 **自己上传** 的文档；删他人文档 **仅** kb `admin`。」
- **已知的 IS 事实（本轮亲核，待工单 02 补全）**：
  - `packages/db/src/schema/kb/kb-members.ts:7` 注释：「role: read | write | admin（库内锚点；**运行时授权以权限码为准**）。」
  - `packages/admin-catalog/src/role-templates.ts:4-5`：「运行时以用户角色绑码并集为准；模板只做种子/锚点。」`defaultCodesForRoles` 只吃**平台角色码**，全仓无一处把 `kb_members.role` 折算成码。
  - `apps/api/src/auth/permissions/resolve.ts:45-53`：`canAccessKbScoped` 只吃 `isKbMember: boolean`，`scope==='kb'` 的码只要求成员资格，**不看 role**。
  - `apps/api/src/auth/middleware.ts:29-30`：`resolveKbMemberFromDb = (userId, kbId) => membersRepo.isMember(userId, kbId)` —— 接口是 **boolean**，role 在类型上就传不出来。
  - `apps/api/src/auth/doc-scope.ts`：前图新抽的读写共用闸，同样只吃 boolean。
  - `apps/api/src/routes/documents/index.ts:491`：`uploadedBy` 在本仓**只**被 ADR-048 四眼自审（`evaluateSelfDecide`）消费——ADR-035 §决策 7 的「删他人文档仅 admin」在源码里**没有对应判定**（待工单 02/03 复核 delete 路径）。
- **本机限制**：无浏览器验证手段 → web / admin 视觉改动不在本图。外部依赖（真 ES / 人签 / 真模型网关）不在本图。
- **门禁**：每收一张工单跑 `pnpm check-types` + `pnpm lint`（零 warning）+ 相关包测试；收口跑全仓 `pnpm test`。测例只进 `<包>/tests/<能力>/<意图>.test.ts`，头注释简体中文，登记该包 `tests/index.md`。
- **质量红线不放宽**：门禁**只加严不放宽**（ADR-046）；min 否决；历史≠evidence；双就绪∧active 检索闸。本图若落地，方向只能是**加严**。
- **回写惯例（本轮实测发现）**：`docs/module-status/*.md` 里**不要**写「`路径:行号`」形式的引用——`check:module-status` 的 `1-路径` 检查只认纯路径，带 `:行号` 会被判「不存在」并产生**误导性告警**（看起来像引用了不存在的文件）。行号引用请放 `.trellis/spec/` 或 `.scratch/`；module-status 侧只写纯路径或不写路径。同理，反引号括起的**枚举字面量**（如 read / write / admin）会被 `5-表` 当作「可能是表名」而报警，与既有 21 条同类噪声叠加——无必要就少加反引号。
- **收口复核纪律（前图教训）**：声明收口必须在**最后一次提交之后**复跑 `pnpm check:module-status`。

## Decisions so far

- [冻结条款对账](./issues/01-research-frozen-clauses.md) — 把 role / read 当授权判据的条款共 **66 条**，其中 **57 条未被任何后续 ADR 点名销账**、9 条被点名（销账链只有四条：ADR-051 `:1342`/`:1343`/`:1344` 与 ADR-045 `:985`）。**最关键发现**：ADR-035 **自己的状态行**（`:480`）已写「部分被 ADR-051 修订（……运行时以权限码为准；**角色列降级为模板锚点**）」；文本内**唯一**明文裁决序在安全 PRD `:76`「**冲突**：catalog/码表 > 旧文案」。另纠两处起点错：观测成员边界在 §5（行 324）非 §4.3；ADR-045 焊死 #3 是行 964（壳准入，已点名改码）与行 965（KB 级按 role，**未销账**）两半。
- [源码实况](./issues/02-research-source-truth.md) — **全仓唯一**读取 `kb_members.role` 的 SQL 只服务成员列表（`services/members.ts:98`），其值只流向 HTTP 响应与 admin UI；**role 在类型上就进不了鉴权链路**（`ResolveKbMember` 回 boolean 等 6 处签名）；ADR-035 §5/§7、ADR-045 焊死 #1 后半 / #3 在源码中**无落点**；ADR-035 §6 的首任库 admin 写入**已实现**（`services/documents.ts:53` 硬编码）。
- [影响面与接口代价](./issues/03-research-impact-surface.md) — 15 个调用点**可以不动**（闸的输入只有 `(c, kbId, posture)`），但 **`posture` 无法表达读写强度**（`'always'` 集合里读写混装）；布尔桩**语义不足**于表达 role：严格意义的「role ≠ write 却断言放行」**0 例**（测试世界里 role 根本不存在），真正要盯的是「role 缺省 + 断言 2xx」这一大类，**须实跑与设计裁决才能定论**。
- [裁定](./issues/04-dec-role-gate-ruling.md) — **去向 C/B**：判据来源 = 权限码 + 成员资格，**不改源码判据**；ADR-045 `:959`/`:965`、`prds/05-api:168-169`、`prds/02-engineering:110` 的 role 判据**留债**（未点名销账，销账须 ADR）。**去向 A（补 role 闸）被明确否决**并写明 4 条理由（与 ADR-051 §2 / 安全 PRD §3.2 焊死对立；争点是判据来源不是宽严；代价收益不对称；与仓内规范自相矛盾）。**反证说明**：行为实验在构造上不可行（注入面签名无法表达 role），故以「类型路 + 穷举路」两路完成，并把「不可行」本身作为最强证据。
- [不落源码改动](./issues/05-task-no-source-change.md) — 本图**不动**任何鉴权源码；理由与替代动作（要收紧就授/收权限码）写进 spec。
- [回写](./issues/06-task-writeback.md) — spec + `module-status/api.md` + `module-status/db.md` + 覆盖表 `S5`（`部分测` → `已测`，按行级重数核对计数）四处落地；实测：`S5` 证据列三文件 **34 例全绿**。

## Not yet specified

- **`read` 成员持 `doc.view` 读该库全部分片正文**（前图遗留）：本图已裁清 —— **不按 role 收紧**（判据 = 码 + 成员资格）；若产品要收紧，正确动作是**收 `chunk.view` / `doc.view` 码**，或给分片正文单列更严的码。**是否收紧仍未定，属产品取向**。
- **`GET …/ingest-jobs` 的暴露面**（前图遗留）：任何 `doc.view` 持有者只要是该 KB 成员就能读全量入库账本（含对账计数与错误码）——粒度是否合适未定。
- **`kb_members.role` 的完整性债**（本图新出）：DB 层**无 CHECK**、读取侧 `MemberListRow.role: string`（`services/members.ts:15`）+ `as KbMember['role']` cast（`routes/members.ts:51`）、`KbMemberSchema` 全仓**无 `.parse()`**。后果：绕过 HTTP 边界写入非法 role 会被原样吐出且无处报错（当前不产生越权，因无授权路径读该列）。补 CHECK 或在读取边界 parse 与否，另图裁定。
- **404 与 403 的存在性探测面**：与写面同源，本图不改 404 语义。

## Out of scope

- 改 `prds/00–11` 已冻语义（须 ADR → 改 PRD → 升版本）
- 切换任何生产默认开关 · 真 ES / 人签 / 真模型网关
- web / admin 的视觉与交互改动（本机无浏览器验证手段）
- 覆盖表里与 role 无关的其余 `部分测` / `缺实现` 行
