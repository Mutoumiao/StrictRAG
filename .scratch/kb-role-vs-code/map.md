# KB 内 role 与权限码的竞合：冻结条款对账与去向

Label: wayfinder:map
Status: open

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
- **收口复核纪律（前图教训）**：声明收口必须在**最后一次提交之后**复跑 `pnpm check:module-status`。

## Decisions so far

（待前沿工单产出）

## Not yet specified

- **`read` 成员持 `doc.view` 读该库全部分片正文**（前图遗留）：`chunk.view` 属 kb_admin 模板码，但用户可被追加授码；是否该读面也按 role 收紧，与本图同一裁定面。
- **`GET …/ingest-jobs` 的暴露面**（前图遗留）：任何 `doc.view` 持有者只要是该 KB 成员就能读全量入库账本（含对账计数与错误码）——粒度是否合适未定。
- **若裁定为「ADR-051 已取代 role 条件」**：ADR-045 焊死 #1/#3 的文本销账需 ADR + 升版本，**不在本图**（本图不得改 `prds/00–11`）；本图只负责把「条款仍在、判据已变」这件事记成可检索的债。
- **404 与 403 的存在性探测面**：与写面同源，本图不改 404 语义。

## Out of scope

- 改 `prds/00–11` 已冻语义（须 ADR → 改 PRD → 升版本）
- 切换任何生产默认开关 · 真 ES / 人签 / 真模型网关
- web / admin 的视觉与交互改动（本机无浏览器验证手段）
- 覆盖表里与 role 无关的其余 `部分测` / `缺实现` 行
