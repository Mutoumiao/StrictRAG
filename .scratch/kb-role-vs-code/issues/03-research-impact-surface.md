# 03 · research：若把 role 纳入闸，影响面与接口代价

Type: research
Status: resolved
Blocked by: 无

> 本工单**不预设** role 该不该入闸，只做影响面前置调查。全部为**静态枚举（未实跑）**。

## 一、接口代价

### 现状签名（要点）

- `middleware.ts:26` `ResolveKbMember = (userId, kbId) => Promise<boolean>`；`:29-30` `resolveKbMemberFromDb = (u,k) => membersRepo.isMember(u,k)`；`:36-39` `getKbMemberCache(c): Map<string, boolean>`；`:43-52` `resolveMembershipCached(...): Promise<boolean>`
- `kb-scope.ts:6` `ResolveKbMemberFn`（同形）；`:18-29` `lookupKbMembership({ cache: Map<string,boolean> })`
- `middleware/request-id.ts:11-15` `kbMemberCache?: Map<string, boolean>`
- `services/members.ts:82` `isMember(userId, kbId): Promise<boolean>`（SQL 只取 id）
- `auth/permissions/resolve.ts:45-54` `canAccessKbScoped({ roleCodes, effective, requiredCode, isKbMember })`
- `auth/doc-scope.ts:29` `DocGatePosture`；`:31-34` `DocScopeDeps`；`:36-40` `DocMemberGate = (c, kbId, posture) => Promise<Response | null>`；`:42-50` `createDocMemberGate(deps)`
- 路由工厂 deps 10 处（`documents/index.ts:98` · `routes/chunks.ts:45` · `ask.ts:70` · `chunk-strategies.ts:32` · `sessions.ts:17` · `kb-settings.ts:46` · `feedback.ts:44` · `eval.ts:68` · `ingest-report.ts:15` · `members.ts:24`），全部写作 `resolveKbMember?: ResolveKbMember`

### 最有价值的一问：能否不动 15 个调用点？

**能**（针对「不动 15 个调用点」），但**不能**「不动任何既有类型」。理由：

1. 15 个调用点只传 `(c, kbId, posture)`（`doc-scope.ts:36-40`），role 的解析与消费全在 `doc-scope.ts` / `middleware.ts` 内部 → 加 `DocScopeDeps` 注入位后调用点字面不改。✅
2. `ResolveKbMember` / `resolveKbMemberFromDb` / `membersRepo.isMember` 三件套**可原样保留**，新增并行的 role 解析即可，既有约 50 处注入点在类型上继续合法。✅
3. **两处必改**：`ApiVariables` 需第二条缓存（现为 `Map<string, boolean>`）；`DocScopeDeps` 需加注入位（并连带 `documents/index.ts:98`、`chunks.ts:45` 两个工厂）。
4. **真正的卡点**：`posture` **无法**表达读写强度 —— `'always'` 集合里既有写入口（#7 / #9 / #10）又有读入口（#14 / #15）。要区分，只有两条路：① 给 `DocMemberGate` 加第四参（= 改 15 个调用点，不推荐）；② 在 `requirePermission*` 里把权限码写进请求变量、由闸内部按码表推导（只改 `middleware.ts` + `request-id.ts`）。**②是保住 15 个调用点的关键设计选择**，但把耦合从调用点挪到了中间件与码表。
5. **口径分叉（必须先裁）**：
   - **V1（仅 doc 闸）**：role 只在 `doc-scope.ts` 内消费，`canAccessKbScoped` 不动 → 15 个调用点不动；但覆盖表 `S5` 缺口指向的正是 `resolve.ts:41-54`，**该处不被覆盖**；ask / sessions / members / kb-settings / chunk-strategies / eval / feedback / ingest-report 等走 `:kbId` 的入口仍只看成员资格。
   - **V2（全 kb 授权闸）**：role 进 `canAccessKbScoped` / `evaluateKbMember` → `resolve.ts:45-54` 签名必改，且下述 B/C/D 类测例大面积进红名单。

## 二、测例红名单（**静态枚举，未实跑**）

**严格意义的「成员 role ≠ admin/write 却断言写入口放行」＝ 0 例。** 全仓 `tests` 里 `role:` 字面量只出现在 HTTP body 或内存仓参数（`role: 'read'|'write'|'admin'`，见 `acl/members-http.test.ts`、`acl/kb-scope-write-isolation.test.ts:84,103`、`auth/enforce-permission-matrix.test.ts:134`），**没有任何夹具为「被授权写作」的用户设置过 `kb_members.role`** —— 测试世界里 role **不存在**，成员资格一律是 boolean 桩。

真正要盯的是「成员 role **缺省（未建模）** + 断言闸放行 2xx」，其是否变红取决于「role 缺省」被解释为「拒绝」还是「不参与」——**属设计裁决，须实跑才能定论**。

| 类 | 特征 | 代表文件（节选） | 风险 |
|----|------|------------------|------|
| **A** | 模块级 `vi.mock` 布尔桩（`isMember: async () => true/false`，spread `...actual.membersRepo`） | `auth/enforce-permission-matrix.test.ts:37-41` · `acl/kb-member-gate.test.ts:29-34` · `ingest/complete-pending-role.test.ts:33` | 若默认解析改调新方法，`...actual` 会留下**真实现** → 打真 PG；静态可判**必改** |
| **B** | `always` 姿态入口（闸必然执行）而成员 role 缺省却断言 2xx | `ingest/document-meta.test.ts:81` · `document-doctype.test.ts:78` · `document-effective-window.test.ts:82` · `dedupe-conflict-resolve.test.ts:66` · `acl/documents-acl-endpoint.test.ts:67` · `documents-acl-principals.test.ts:95` · `ingest/chunks-http.test.ts:70` · `acl/chunks-dept-filter.test.ts:66` · `kb/chunk-strategy-preserves-docs.test.ts:104` · `kb/chunk-strategy-audit.test.ts:74` · `obs/quota-planes.test.ts:137` | V1 涉 #7/#9/#10/#14/#15；V2 另含全部 kb-scoped 码路径 |
| **C** | 新闸的两条主人证用例把「KB_B 成员」当可写主体，而该成员**没有 role** | `acl/doc-write-kb-member-gate.test.ts:111`（断言 2xx 于 `:160/:188/:234/:255`）· `acl/doc-read-kb-member-gate.test.ts:82`（`:179/:190/:226/:248`） | **最直接的红名单** |
| **D** | `kbId === X && members.has(userId)` 型桩 + 2xx 断言 | `kb/settings-http.test.ts:60` · `kb/settings-audit-http.test.ts:59` · `kb/doc-type-catalog-http.test.ts:44` · `kb/chunk-strategies-http.test.ts:64` · `kb/kb-consume-bindings-http.test.ts:65` · `kb/create-kb-with-models.test.ts:127,190` · `ingest/ingest-report-http.test.ts:42` · `sessions/http.test.ts:55` · `feedback/http.test.ts:59` · `eval/http-eval-runs.test.ts:111` · `ask/*` 多件 · `acl/members-http.test.ts:46` · `acl/kb-scope-write-isolation.test.ts:37` 等 | 同上，按口径决定 |
| **E** | **不**进红名单（静态可判） | 模块单例 + 只打 `whenEnforced` 且 `AUTH_ENFORCE` 默认关：`ingest/approve-then-scan.test.ts` · `document-lifecycle-http.test.ts` · `document-supersede.test.ts` · `document-delete.test.ts` · `no-self-approve.test.ts` | **前提**：`doc-scope.ts:44` 的执行顺序（posture 判断**先于**解析）不变；顺序若改即变红 |

**`resolveKbMember` 桩注入写法全清单：34 个文件 / 约 50 处**，归为 5 种写法（① `async () => true`；② `kbId === KB && members.has(userId)`；③ `kbId === KB && uid === userId`；④ `…memberSet.has`；⑤ 恒 false / 形参声明）。

**布尔桩加 role 后是否仍合法**：
- **类型层面：合法**（`ResolveKbMember` 不改则 50 处全过 `check-types`）。
- **语义层面：V1 下仍成立**（role 由另一条注入解析）；**V2 下不足**（role 只有成员行一个来源，布尔桩**无法表达 role** → 上述 B/C/D 的 2xx 断言在「role 缺省≠write」口径下集体变红）。

## 三、镜像与覆盖表口径

- `docs/testing/coverage/02-acl.md:58`（**S5** 行）「缺口」列逐字：「补测后仍缺一截：成员角色粒度——`apps/api/src/auth/permissions/resolve.ts:41-54` 只看成员资格，`kb_members.role` 不参与写闸，故只能按「库成员资格 + 码」断言（同测例）。」
- 计数段：`:139`「共 **69**」；`:141-148` 计数表 `已测 45 / 部分测 19 / 缺测 0 / 缺实现 2 / 延后 0 / UAT 3 / 合计 69`；`:150` 自检 ID 69 无漏号；`:156` 部分测子集「S1 S3 S4 **S5** · Y6 · X4 X5」；`:158`「S3 / **S5** 为本批补测后仍缺一截」。
- `docs/module-status/api.md` 成员闸边界句在 `:33 / :34 / :35 / :38 / :47 / :59 / :89 / :92 / :111 / :112 / :160 / :163`。
- `docs/module-status/db.md`：`kb_members` 的**唯一**条目是 `:41`（清单式一行，**无 role 语义描述**）；边界表 `:69`「权限三表终态……」；证据表 `:93-104` **未列 `kb-members.ts``。

## 四、规范落点

`.trellis/spec/api/backend/auth-authorization.md`：
- `:86-97` 小节「路径只有 `:docId` 的文档入口必须补成员闸（强制，读写同口径）」——`:90` 落点、`:91` 挂点（写 10 + 读 5）、`:92` 顺序、**`:93` 姿态随该入口权限码**、`:94` 注入、`:96` 测例、`:97` 残余。
- `:108-113` 权限求值代码块（含 `canAccessKbScoped` 签名）；`:77-83` ARCH-P1b-1 表（含 `ApiVariables.kbMemberCache` 行）；`:55` 默认解析说明；`:406` 超管 `bypassKbMembership` 作用域。
- **若走 V1**：改 `:90/:93/:94/:96/:97`（+ 可能 `:77-83` 缓存行 + `:60-70` 示例）。
- **若走 V2**：另必须改 `:108-113`、`:406`、`:55`，且 `quality-guidelines.md:40`（禁「仅判断 role 字符串就放行」）需与「role 参与闸」并置改写 —— 否则 spec 自相矛盾（`kb-members.ts:6-8` 注释与 role 入闸直接对立）。

## 五、须实跑才能定论的清单

1. B/C/D 类**到底红多少**（取决于「role 缺省」的解释）。
2. A 类 3 个模块级布尔 mock 的**失败形态**（403 / 打真 PG 抛错 / 挂死）。
3. E 类「不红」依赖 `doc-scope.ts:44` 执行顺序不变。
4. `role` 默认 `'read'` 对既有数据分布的影响（静态可见写入点，真实分布须查库）。
5. `pnpm test` / `pnpm check-types` 的实际结果（本工单明确不跑）。
