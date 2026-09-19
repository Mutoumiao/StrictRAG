# 补测批 4 · 边界护栏（N2 / S6 / Z3 / C4）

Type: task
Status: resolved
Blocked by: —

## Question

把 4 条边界行补到有护栏断言（这几行不在 94 行主盘内，但与 P2 出口相关，被单独列出）：

| 行 | 今天缺的断言 | 落点 |
|----|--------------|------|
| N2 | 「Mongo 正文读写无应用层字段 encrypt wrapper」的护栏 | `apps/worker/tests/ingest/mongo-body.test.ts`（补 `it`） |
| S6 | 切换 KB 后写菜单隐藏 / 写路由 403 | `apps/admin/tests/shell/kb-switch-write.test.tsx`（新） |
| Z3 | 未点详情不得预拉全部 chunk body | `apps/admin/tests/ops/chunks-workspace.test.tsx`（新，与批 3 的 Z4/Z8 同文件） |
| C4 | L1 Hit@k 的逻辑 id→uuid 映射层断言 | `packages/contracts/tests/eval/l1-hit-at-k.test.ts`（补 `it`） |

约束：C4 只补映射层逻辑，**不得**把它接进签字公式（`prds/08-quality` 已冻：Hit@k 不进签字公式）；N2 是护栏（断言「没有」），写不成绿就说明源码有该 wrapper，要报告而非迁就。

## Answer

**3 行补成，1 行拒绝造假绿并改判。**

| 行 | 结果 | 断言要点 |
|----|------|----------|
| N2 | **已测**（+3 it，`apps/worker/tests/ingest/mongo-body.test.ts`） | 打桩 `mongodb` 捕获 `updateOne` 的 `$set`：正文与明文**逐字节相等**且字段集恰为 `docId/kbId/text/updatedAt`；`upsertChunkBodies` 逐块同口径（出现 `ciphertext`/`enc`/`iv` 即红）；`findDocumentBody` 回读无应用层解密。源码侧无 `node:crypto`、无 encrypt/decrypt 包装 → 护栏成立 |
| Z3 | **已测**（+2 it，`apps/admin/tests/ops/chunks-workspace.test.tsx` 新建） | 选文档只调 `loadChunkList(docId,{limit:50})`，3 条 preview 全渲染后 `loadChunkBody` **零调用**；点某块后恰一次且为该 chunkId，另两块不拉 |
| C4 | **已测**（+3 it，`packages/contracts/tests/eval/l1-hit-at-k.test.ts`） | 逻辑 id 与 KB uuid 互不命中且不抛错 · 换成 uuid 后才命中 · 只认 trim 后全等。**未**接进 2×2 / `signoffEligible`（`prds/08` 已冻：Hit@k 不进签字公式） |
| S6 | **无法断言 → 拒绝造假测，改判 `缺实现`** | 见下 |

**S6 为什么不能写测（这是本工单最有价值的产出）**

`apps/admin/tests/shell/kb-switch-write.test.tsx` **未创建**，因为该 Then 在 admin 层**没有实现对象**：

- 菜单 = `clipMenuForShell(new Set(me.permissions))`（`apps/admin/src/components/admin-shell.tsx:76-83`）—— 入参只有**平台码**，不含 KB 维度；
- `AuthMeResponseSchema` 无 `byKb`（`packages/contracts/src/auth/session.contract.ts:53-66`，注释写明「本批不返回 byKb」）；
- 切库只写 localStorage（`admin-shell.tsx:84-87` + `lib/kb-context.ts`），运营页 load 时读一次、**无 KB 变更事件**；
- `app/(ops)/layout.tsx` 只有 Guard + Shell，全仓 admin **无 middleware**，写入口一律 `me.permissions.includes(...)`。

所以覆盖表把 S6 记成「缺测（源码已具备）」是**与源码冲突**的，实为 `缺实现`；403 的真值在 api（即 S5 挂的「同用户跨库写隔离 HTTP」）。已据此回写覆盖表（见工单 [06](./06-coverage-table-writeback.md)）。两条让它有落点的路径：① 给 `/auth/me` 加 `byKb`，再写「写菜单隐藏」测；② 把断言移回 api，扩 `apps/api/tests/acl/kb-member-gate.test.ts` 一条「同用户 KB-B 可写 / KB-A 403」。

**验证**：worker **39 文件 / 193 通过** · admin **35 / 173 通过** · contracts **27 / 224 通过**（三包均先跑存货闸，apps 另跑夹具闸）；`check-types` **8/8**；`lint` **8/8 零 warning**。全仓 `pnpm test` 收口时 **11/11**。三份 `tests/index.md` 已登记。

**边界**：未改源码；未写假绿；`docs/testing/` 由工单 06 统一回写（本工单只在答案里给出改判结论）。
