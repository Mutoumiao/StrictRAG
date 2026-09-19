# 授权纵深缺口：无 `:kbId` 的文档写入口不查 KB 成员资格

Type: grilling
Status: open
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

（进行中）
