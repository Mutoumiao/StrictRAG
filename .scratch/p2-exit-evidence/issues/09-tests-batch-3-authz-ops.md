# 补测批 3 · 鉴权矩阵与运营壳

Type: task
Status: resolved
Blocked by: —

## Question

把覆盖表 P2 必签余量中「鉴权矩阵与运营壳」这 38 行补到有实质断言：**B1-2 · B1-3 · B1-5 · B1-8 · B1-A3 · S2 · S3 · S5 · S8 · S9 · Y2 · Y3 · Y5 · W6 · W8 · Z4 · Z5 · Z6 · Z8 · AE1 · X2 · X7 · G1 · G2 · G3 · O2 · P6 · T1 · T2 · T3 · AB1 · AB2 · AB5 · AB7 · AC6 · AD5 · AD9 · AD10**。

预计约 40 条 `it`。**先建「`AUTH_ENFORCE=true` 权限矩阵」夹具**（落 `apps/api/tests/auth/enforce-permission-matrix.test.ts`），一次吃掉 B1-2 / B1-8 / S2 / S8 / Y3 五行；其余为 HTTP 与 RTL 断言的机械补齐。完整落点清单见 `research/coverage-partial-tests.md` 末节批 3。

约束：**禁止**把仓库默认 `AUTH_ENFORCE` 改成 on（权限矩阵夹具须在测试内部显式开启，不落 `.env` 默认）；门禁只加严不放宽；测例登记各包 `tests/index.md`。

## Answer

38 行全部处理，新增 **约 49 条 `it`**（8 个新文件 + 19 个文件补 `it`）；四包测试 + `check-types` + `lint` 全绿。

**夹具先行（吃掉 5 行）**：`apps/api/tests/auth/enforce-permission-matrix.test.ts`（4 it）—— 用**测试内** `vi.stubEnv('AUTH_ENFORCE','true')`（`afterEach` 还原，**不动** `.env` 与 `env.ts` 默认），挂真实路由并把 `membersRepo.isMember` mock 成恒 true，使 403 **只能**源于缺码；对照条用同一令牌打 ask 仍 200。它覆盖 **B1-2**（read 六类写入口 403 且指名缺失码）· **B1-8 / Y3**（doc_operator 审批 403）· **S2** · **S8**（不挂壳仍 403）。

**其余按剧本（择要）**：B1-3 doc_operator 邀请/移除 403 且成员未被改 · B1-5/Y5 超管非成员可列/可管理、对照 kb_admin 非成员 403，且超管非成员写仍落 `admin_write` 审计 · B1-A3 ES 返回他库 chunkId 被语料求交丢弃 · **S5 新的 `kb-scope-write-isolation`（3 it）**：成员库写 200/201、非成员库 403、无码者即便成员也 403 · S9 web 页面无上传入口 · Y2 enforce 开 + doc_operator → complete 200 但审批 403 · W6/W8 面板写方法 404、授 `dashboard.view` 前后 403→200 · Z4/Z5/Z6/Z8 分片详情与运营壳 · AE1/X2/X7 部门树与 scope/citation 对账 · G1/G2/G3 反馈闭环与 `gold.yaml` 只读护栏 · P6/T1/T2/T3 eval 快照与「严于试点」绑定 · AB1/AB2/AB5/AB7 设置页与写路径即时生效 · AC6 网关解析 · AD5/AD9/AD10 平台角色与菜单裁剪。

**七处如实记「无法断言 / 口径冲突」（未写假绿）**

1. **G1 负向**：`apps/api/src/routes/feedback.ts:99-150` **不读轮次状态**，`TraceLookup` 无 status 字段 → 「仅 abstained 可开单」**无闸可断言**，只补正例。
2. **G2**：「上传后关闭」—— 全仓只有 `feedback-workspace.tsx:126` 手动 `linked_doc`，**无上传联动代码**。
3. **S3 读面**：`documents/index.ts:141` 走 `doc.view`，而 `web_consumer` 模板码为空（`admin-catalog/src/role-templates.ts:60`），enforce 开时 403 —— 与 Then「read 列文档可达」**冲突**，按现状记录待裁口径。
4. **S5 粒度**：`auth/permissions/resolve.ts:41-54` 只看成员资格，`kb_members.role`（read/write）**不参与写闸**，只能按「成员资格 + 码」断言。
5. **T1/T2/T3**：`eval/adr046-snapshot.ts:129` 的 `l1RerunBound` 用 `kbId && ranAt` 也算真 → 「无 evalRunId 即不得 bindable」**不成立**；只断言 `signedPackage/businessPass=false` + `loosened_hard_gate` 与落盘裁决拒绝。
6. **O2 写侧**：落点 `apps/worker/tests/ingest/es-http.test.ts` **超出本批允许范围**（只许 api/admin/web/admin-catalog）→ 只补了 api 查侧；写侧同源**仍缺**。
7. **AB7**：既有 `kb/doc-type-catalog-http.test.ts` 已具实质断言，未重复造测例。

**额外发现（已立工单 [14](./14-dec-doc-write-kb-membership.md)）**：**路径上没有 `kbId` 的文档写入口只验权限码、不查 KB 成员资格** ——

```
apps/api/src/routes/documents/index.ts:694   PATCH /documents/:docId
apps/api/src/routes/documents/index.ts:845   PUT  /documents/:docId/acl
```

即持码但非该 KB 成员者可写他库文档。这是**授权纵深**问题，但「是设计还是缺口」需先裁（平台运营角色是否天然跨库），故**没有**擅自加闸，只立决定票。

**验证**：api **160 文件 / 971 通过**（3 skip）· admin **38 / 185** · web **19 / 56** · admin-catalog **1 / 13**；全仓 `pnpm test` **11/11**；`check-types` 8/8；`lint` 8/8 零 warning（曾报一处未用变量已删）。四包 `tests/index.md` 已登记。

**边界**：未改源码；默认 `AUTH_ENFORCE` 未动（夹具只在测试内开）；门禁未放宽。
