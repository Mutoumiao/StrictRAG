# 04 · dec：裁定 —— KB 内 role 是否参与闸（本图枢轴）

Type: grilling
Status: resolved
Blocked by: 01, 02, 03（均已收）

## 裁定

**去向 C（分层），实质落点 = B（不改源码判据）**：

1. **判据来源以「权限码 + KB 成员资格」为准**；`kb_members.role` 在**运行时授权**上**不**参与闸。故 **不改**任何鉴权源码判据。
2. **但有**一条 role 条件**必须留债**：ADR-045 焊死 #1 纵深句（`00-adr-index.md:959`）与焊死 #3 的 **KB 级半句**（`:965`）**未被任何后续 ADR 点名销账**；`prds/05-api/01-http-api-hono.md:168-169` 在**当前版本**仍以 `write+` / `kb_admin` 写删除判据；`prds/02-engineering/01-clhoria-template-alignment.md:110` 明文写「写操作仍按**权限码 + KB 行 role**」。这些是**同一批 00–11 冻结文本内部的并列/冲突**，要销账须 **ADR → 改 PRD → 升版本**，**不在本席授权范围**（本图不得改 `prds/00–11`）。
3. **一处不落地**：ADR-035 §决策 7 的**归属**规则（「write 可删自己上传；删他人仅 kb admin」）在源码中**没有任何落点**（`services/document-delete.ts:13-21` 的入参只有 `{ id }`）。它同样是 role 条件的，归入第 2 条的债，**本图不实现**（理由见下「为何不落地」）。

## 证据链（每一条都能指到原文）

| # | 证据 | 位置 | 方向 |
|---|------|------|------|
| 1 | 「授权 SSOT = permission code……运行时**以有效码为准**；`platform_role` / `kb_members.role` 为**模板锚点**」 | `prds/11-decisions/00-adr-index.md:1352`（ADR-051，0.4.25） | 判据来源 = 码 |
| 2 | ADR-051 §决策 9 否决列：「**无码只靠 role 字符串**」 | 同上 `:1366` | 否决 role 判据 |
| 3 | **ADR-035 自己的状态行**：「已接受 · **部分被 ADR-051 修订**（超管全权、运行时以权限码为准；**角色列降级为模板锚点**）」 | 同上 `:480` | ADR-035 §5/§7 的 role 判据**被点名**降级 |
| 4 | 安全 PRD §3.2 焊死「**以码为准**……禁止只判断 role 字符串而无码」；「非超管：KB 操作须该 KB 上下文有效码；无码 → **403**」 | `prds/09-security/01-auth-acl-compliance.md:102` / `:104`（0.4.34，当前版本） | 判据来源 = 码 |
| 5 | **文本内唯一明文裁决序**：「**冲突**：catalog/码表 > 旧文案」 | 同上 `:76`（0.4.34） | 冲突时码表优先 |
| 6 | 「身份锚点（兼容）：`platform_role` / `kb_members.role` **可映射默认角色** \| P2 保留」 | 同上 `:73` | role 是锚点，且「可映射」是**许可**非**义务**；映射函数全仓不存在 |
| 7 | 源码注释自认：「放行唯一条件：有效码包含 requiredCode（+ kb 成员上下文，超管旁路）。**禁止只判断 role 字符串**」 | `apps/api/src/auth/permissions/resolve.ts:7-11` | 源码与 1/4 一致 |
| 8 | 列注释：「role: read \| write \| admin（库内锚点；**运行时授权以权限码为准**）」 | `packages/db/src/schema/kb/kb-members.ts:7` | 同向 |
| 9 | 模板注释：「运行时以「用户角色绑码并集」为准；模板只做种子/锚点」；`defaultCodesForRoles` 只吃**平台角色码** | `packages/admin-catalog/src/role-templates.ts:4-5` / `:71-79` | 同向 |
| 10 | **role 在类型上就进不了闸**（6 处签名）：`ResolveKbMember` / `ResolveKbMemberFn` 回 `Promise<boolean>`；`lookupKbMembership` 缓存 `Map<string, boolean>`；`canAccessKbScoped` 入参无 role；`GateResult` 无角色字段；`membersRepo.isMember` 的 SQL 只 `select({ id })` | `middleware.ts:26` · `kb-scope.ts:6,18-29` · `permissions/resolve.ts:43-54` · `middleware.ts:158-160` · `services/members.ts:84-91` | 结构性排除 |
| 11 | 全仓**唯一**读取该列的 SQL 只服务成员列表；其值只流向 HTTP 响应与 admin UI | `services/members.ts:98` · `routes/members.ts:51` | 无授权消费方 |

## 反证实验（实测说明）

**结论：本裁决的反证以「类型 + 穷举」两路完成，行为实验在构造上不可行——而这正是最强证据。**

- **不可行的理由（实测观察）**：闸的**唯一**注入面是 `resolveKbMember?: ResolveKbMember`，其签名 `(userId, kbId) => Promise<boolean>` **无法表达角色**（`middleware.ts:26`；约 50 处注入点、34 个测试文件全为布尔桩，见工单 03 §2.3）。因此**不存在**「给某个有码的授权主体设一个 role 再观察闸行为」的缝隙：任何这样的实验都只是在测我自己写的桩，属循环论证。
- **可做的两路反证已经做了**：① **类型路**：上表第 10 条的 6 处签名逐一核对，role 无输入通道；② **穷举路**：全仓 `from/insert/update/delete(kbMembers)` 仅 7 处、读该列的 SQL 仅 1 处（上表第 11 条），已逐处核对。
- **可执行的替代实证（本次已跑）**：把覆盖表 `S5` 证据列点名的三个测例文件**实跑**，验证「对 KB-A 写 403 / 对 KB-B 写可达」这一 Then 确由现行测试保证（结果见工单 06 的落地记录）。
- **不做的事**：不以「临时把 role 判定插进闸看谁变红」充当反证——那证明的是**改动的影响面**（工单 03 已静态枚举），**不是**现状判据。

## 被否决的两种去向及理由（防重开）

### 去向 A（判定为缺口 → 源码补 role 闸）：**否决**

1. **与现行最新文本对立**：ADR-051 §决策 2（`1352`）与安全 PRD §3.2 焊死（`102`/`104`）都以码为判据来源，且 §9 明列否决「无码只靠 role 字符串」。补 role 闸等于**同时推翻**这两条，属**改冻结语义**，须 ADR → 改 PRD → 升版本。
2. **不是宽严问题，是判据来源问题**：ADR-046「门禁只加严不放宽」管的是**同一判据下的严松**；本争点是**判据来源**（码 vs role），不能用「加严」正当化。
3. **代价与收益不对称**：需改 `canAccessKbScoped` 签名（V2）或另建 role 解析通道（V1），并使工单 03 列出的 B/C/D 类大量既有 2xx 断言失去判据；而收益是一个**尚未被裁定为义务**的约束。
4. **与仓内规范自相矛盾**：`.trellis/spec/api/backend/quality-guidelines.md:40` 与 `kb-members.ts:7` 注释都将与「role 入闸」直接对立，须先改规范，而规范又必须服从冻结语义。

### 去向 B（裁定已被取代 → 源码不动、镜像记债）：**部分采纳**

采纳其「源码不动」；**不**采纳「可以宣称已销账」——因为 §959 / §965 / `05-api:168-169` / `02-engineering:110` **未被任何后续 ADR 点名**，按本图「未点名即未销账」的口径不得宣称已解决。故本裁定 = **B 的落地 + A 的留债登记**。

## 没落地的部分（明确写出）

| 条款 | 状态 | 原因 |
|------|------|------|
| ADR-045 焊死 #1 纵深句（`:959`） | **未落**，留债 | 与 ADR-051 §2 冲突，销账须 ADR |
| ADR-045 焊死 #3 KB 级半句（`:965`） | **未落**，留债 | 同上；「read-only KB」在源码与 schema 中**无对应物** |
| `05-api:168-169` 删除判据（`write+` / `kb_admin`） | **未落**，留债 | 当前版本正文，须 ADR 才能改 |
| ADR-035 §决策 7 归属规则（删自己上传 / 删他人仅 admin） | **未落**，留债 | role 条件；且 `evaluateDocumentDelete` 入参连 `uploadedBy` 都拿不到 |
| `02-engineering:110`「码 + KB 行 role」并列句 | **未落**，留债 | 同上 |
| `kb_members.role` 的 DB 层完整性（无 CHECK、读取侧 cast、`KbMemberSchema` 无 `.parse()`） | **未落**，转雾 | 与授权判据无关；属独立完整性债，本图不动 |
