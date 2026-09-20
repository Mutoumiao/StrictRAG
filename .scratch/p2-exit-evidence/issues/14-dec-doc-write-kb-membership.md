# 授权纵深缺口：无 `:kbId` 的文档写入口不查 KB 成员资格

Type: grilling
Status: resolved
Blocked by: —

## Question

补测批 3（工单 [09](./09-tests-batch-3-authz-ops.md)）在写「同用户跨库写隔离」时发现：**路径上带 `:kbId` 的入口**都做了成员/作用域校验（`requireKbScope` / `requireKbMember`），但**路径上没有 `kbId` 的文档写入口只验权限码、不查 `kb_members`**：

```
apps/api/src/routes/documents/index.ts:694   PATCH /documents/:docId
apps/api/src/routes/documents/index.ts:845   PUT  /documents/:docId/acl
```

即：**一个持 `doc.editor`（或 `doc.acl`）码、但不是该文档所属 KB 成员的用户，可以写他库的文档。**

要裁的问题是：**这是设计如此，还是缺口？**

- 若属**设计**（平台运营角色天然跨库），要写清在哪一级文档里承认（ADR-045 的纵深口径？），并把这条**写进镜子的边界**，免得下次又当缺口查一遍；
- 若是**缺口**，则要定闸的形态：从 `:docId` 反查 `kbId` 后过 `requireKbMember`？还是只对非超管加闸（已有 `roleBypassesKbMembership` 这个口子，需确认它是否适用于此处）？并评估对现有 admin 运营流的影响（超管/平台运营今天能不能写非成员库的文档）。

## 相关既有事实（供裁定参考，勿当结论）

- 超管绕过已有先例：`P3b-SA`（`roleBypassesKbMembership`，默认关）。
- 路径带 `kbId` 的写入口已有闸：`S5` 的 `kb-scope-write-isolation` 测例（本次批 3 补）。
- `kb_members.role`（`read` / `write`）**不参与**写闸（`apps/api/src/auth/permissions/resolve.ts:41-54` 只看成员资格）—— 这是另一条独立的口径问题，别混进本票。

## Answer

**裁定：是缺口，不是设计。而且洞口比本票描述更大——实测是 10 个入口，不是 2 个。**

### 一、先消掉本票前提里的一个错

`doc.acl` **不是**权限码。`packages/admin-catalog/src/permissions.ts` 全表 21 码无此项；`PUT /documents/:docId/acl` 实际用的码是 `doc.editor`（路由注释亦写「权限与 PATCH 同一码」）。裁定不能建在这个空指上。

### 二、为什么判「缺口」（契约依据）

1. **ADR-035 §决策 4**（`prds/11-decisions/00-adr-index.md:500`）：「无 kb_members 行 → 该 KB 一切内容路径 403（ask、读文档内容/列表、上传、**删文档**、成员、KB config、feedback 队列、eval）」。**「删文档」即 `DELETE /documents/:docId`**，与 `PATCH /documents/:docId` 同为「路径只有 `:docId`」形态——契约既已点名这类入口，就不存在「路径无 `kbId` 即豁免成员闸」的空间。
2. **ADR-045 焊死 #1**（`:957-959`）：「纵深：各 admin **API handler** 仍按 ADR-035 矩阵校验 kb_members.role（**中间件漏了也不放行写**）」——恰好覆盖「中间件拿不到 `:kbId`」这一情形。
3. **ADR-045 焊死 #3**（`:963-965`）：「对某 KB 的写仍按该行 role」「**禁止**「能进 admin = 全 KB 写权」」。
4. **模型层**：`apps/api/src/auth/permissions/resolve.ts:43-54` 的 `canAccessKbScoped` 是 ADR-051 落地口径——**码 ∧（scope≠kb ∨ super_admin ∨ 是成员）**；而 `doc.editor` / `doc.lifecycle` / `doc.upload` / `doc.reindex` / `approval.decide` 的 scope **全为 `kb`**（`permissions.ts` 21 码映射）。中间件只在 path 有 `:kbId` 时才取成员（`auth/middleware.ts:187-191`）——这就是洞的机制。
5. **角色模板已把答案写死**：`packages/admin-catalog/src/role-templates.ts:39-68` 只有 `super_admin` 是 `bypassKbMembership: true`，`kb_admin` / `doc_operator` 均为 `false`。这些入口若不查成员，模板里的 `false` 就是空话。

### 三、为什么「平台运营天然跨库」立不住（反方证据）

- 全仓正则 `天然跨库|平台运营.*跨|跨库写` **零命中**：不存在该设计表述。
- 唯一出现「平台运营账号」的是 `prds/12-delivery-guides/14-模块需求功能表.md:265`，语义还是「**≠ KB 成员**」。
- 可核对角色只有四个模板；`doc_operator` 显示名「文档运营」，不是跨库角色。
- 仓内**已备好这类入口的专门闸**：`evaluateKbMember`（`auth/middleware.ts:232`）注释即「仅成员闸（**handler 级 / 无 path kb 时**）」。有现成闸而不用，指向实现漏点而非设计取舍。

### 四、洞的完整清单（10 个）

| 入口 | 权限码 | 该码的闸姿态 |
|------|--------|--------------|
| `POST /documents/:docId/reindex` | `doc.reindex` | WhenEnforced |
| `POST /documents/:docId/approve` | `approval.decide` | WhenEnforced |
| `POST /documents/:docId/reject` | `approval.decide` | WhenEnforced |
| `POST /documents/:docId/scan` | `doc.upload` | WhenEnforced |
| `PATCH /documents/:docId/lifecycle` | `doc.lifecycle` | WhenEnforced |
| `POST /documents/:docId/supersede` | `doc.lifecycle` | WhenEnforced |
| `POST /documents/:docId/dedupe-conflicts/:chunkId/resolve` | `doc.editor` | `requirePermission`（始终） |
| `DELETE /documents/:docId` | `doc.lifecycle` | WhenEnforced |
| `PATCH /documents/:docId` | `doc.editor` | `requirePermission`（始终） |
| `PUT /documents/:docId/acl` | `doc.editor` | `requirePermission`（始终） |

### 五、定闸形态（已实现）

- **handler 级**，落点 `apps/api/src/routes/documents/index.ts` 的 `docWriteMemberDenied(c, kbId, posture)`；挂在取到 `doc`（dedupe 用 `chunk.kbId`）之后、落仓或入队之前。
- **姿态随该入口的权限码**：`requirePermission` → `'always'`；`requirePermissionWhenEnforced` → `'whenEnforced'`。**不翻转仓库默认**：`AUTH_ENFORCE` 关时 `WhenEnforced` 系照旧放行（与它的码同姿态），`requirePermission` 系本就始终要求令牌、故成员闸也始终查。
- 成员解析经新增的 `createDocumentRoutes({ resolveKbMember })` 注入，默认 `resolveKbMemberFromDb`（查 `kb_members`）；**super_admin 旁路**；拒绝复用 `evaluateKbMember` 的 403 `FORBIDDEN` + `not a knowledge base member`。
- `roleBypassesKbMembership` **适用**于此处——`evaluateKbMember` 内部本就在用（`middleware.ts:240`），无需另开口子。

### 六、对现有 admin 运营流的影响

- `super_admin`：不受影响（旁路）。
- `kb_admin` / `doc_operator` 对**自己是成员的库**：不受影响。
- 唯一新增 403 的是「持码但非成员」这一档——正是模板 `bypassKbMembership: false` 应有的语义。无运营台功能被砍。

### 七、验证

- 新测例 `apps/api/tests/acl/doc-write-kb-member-gate.test.ts`（5 例）已登记 `apps/api/tests/index.md`：非成员 403 且不落仓 / 成员 200 / super_admin 旁路 / `whenEnforced` 入口「关不查、开查」。
- **反证**：把 `docWriteMemberDenied` 临时改成直放 → 新测例 **5/5 红**；还原后 5/5 绿、无残留。
- 既有测例：先实跑拿到 **6 文件 / 14 例**红（断言期望 200/400，实收 500——成员查询打真 PG 抛错），仅改装载方式为 `createDocumentRoutes({ resolveKbMember })` 并注入宽松桩，**断言一字未改**；全量 api **161 文件 / 976 通过 + 3 skipped**；`pnpm check-types` **8/8**。

### 八、明确未做 / 残余

1. **读路径未加闸**：`GET /documents/:docId`、`GET …/acl`、`GET …/chunks`、`GET …/ingest-jobs` 同样是「路径只有 `:docId`」，ADR-035 §决策 4 也点名「读文档内容/列表」。本票**只裁写**；读面加闸会与 `WhenEnforced` 系「`AUTH_ENFORCE` 关时无 auth」的默认冲突，须单独设计 → 已作为新雾登记。
2. **`kb_members.role`（read/write/admin）仍不参与写闸**（`resolve.ts:41-54` 只看成员资格）：与本票相邻但**独立**，见覆盖表 `S5` 行，未混入本次改动。
3. **残余探测面**：闸须先取 `doc` 才知 `kbId`，故持码非成员仍可经 404（文档不存在）与 403（非成员）的差异判断文档是否存在。彻底消掉要让两者同码回复，会改现有 404 语义，未做。
4. **未改契约**：`prds/05-api` §2.3 / §2.4 对这两个端点仍无授权前置栏；`prds/09-security` §3.2 仍只写「非超管 KB 操作须该 KB 上下文有效码」。实现依据取自 ADR-035 / ADR-045 / ADR-051 与码表 `scope`，**未动 `prds/00-11`**。

### 九、收尾时顺手修掉的镜像漂移（非本票范围，一并登记）

按纪律在最后一次提交**之后**复跑 `pnpm check:module-status`，发现「时效」类**并不像地图收口时写的那样已清零**：先取基线实证（把 `api.md` 临时回退到 HEAD 再跑脚本）——**HEAD 上实为 43 条、含 6 条时效**。原因是最初三笔提交（`8af62c0` / `f34678f` / `f570cf7`）落在那次检查**之后**，使 api / worker / db / contracts / web / admin-catalog 六份文档的「最近更新」再次落后于各自包的提交。已按各包**真实**改动补写 2026-09-20 条目（均为补测批或工单 13 的 ES 租户闸；**无** DTO / schema 变更）。终态：**时效类真正清零，总数 43 → 37**（2 env + 13 符号 + 21 表 + 1 联动，全属该脚本已知误报），且我的 `api.md` 改动**净增 0 条**误报（首版写法带出 `FORBIDDEN` 与裸词 `reindex` / `lifecycle` / `doc` 共 4 条，已改写消掉）。留档：`research/module-status-check-head-t14.txt`（基线）与 `research/module-status-check-after-t14.txt`（终态）。
