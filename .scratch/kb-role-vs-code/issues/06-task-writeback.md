# 06 · task：回写（spec / module-status / coverage / 债）

Type: task
Status: resolved
Blocked by: 04

## 四处落地

| 落点 | 写了什么 |
|------|----------|
| `.trellis/spec/api/backend/auth-authorization.md` | 新增小节「**KB 内授权的判据来源：权限码 + 成员资格，`kb_members.role` 不参与（2026-09-20 裁定）**」：依据（ADR-051 `:1352`/`:1366`、ADR-035 状态行 `:480`、安全 PRD `:102`/`:104`/`:76`）、结构证据、**「不要加 role 闸；要收紧就授/收码」**、以及文本债清单与裁定路径 |
| `docs/module-status/api.md` | 「鉴权与权限」小节新增一条边界句（判据 + 唯一读取该列的 SQL + 文本债）；`最近更新` 追加当日条目（写清做了什么 / **未做什么**） |
| `docs/module-status/db.md` | `kb_members` 由一行清单扩为带语义的条目（锚点定位、默认 `'read'`、**不参与授权闸**、唯一读取路径、DB 无 CHECK）；`最近更新` 追加当日条目（**未改 schema / 迁移**） |
| `docs/testing/coverage/02-acl.md` | `S5` 行：`部分测` → **`已测`**，并把原「成员角色粒度」残留改写成裁定说明（**非欠测**）+ 文本债指向；叙事段新增「第四轮（改判 S5 + 重数核对）」；计数表 `已测 45→46` / `部分测 19→18`；`部分测` 子集行去掉 S5 |

## 实测与核对（不只改字）

1. **跑过证据列点名的三个文件**：`pnpm --filter @strict-rag/api test -- acl/kb-scope-write-isolation acl/kb-member-gate kb/settings-http` → **3 文件 / 34 例全绿**（证明该行 Then 确由现行测试保证）。
2. **改状态前先重数**：一次性脚本 `.scratch/kb-role-vs-code/count-rows.mjs` 按行级统计覆盖列，改前 `69 行 / 已测 45 / 部分测 19 / 缺实现 2 / UAT 3`（**与原计数表逐项一致**），改后 `已测 46 / 部分测 18`，与新计数表一致。证据落盘 `counts-before.json` / `counts-after.json`。

## 债（写进镜像，不在本图销账）

- ADR-045 焊死 #1 纵深句（`prds/11-decisions/00-adr-index.md:959`）
- ADR-045 焊死 #3 KB 级半句（`:965`）
- `prds/05-api/01-http-api-hono.md:168-169`（`DELETE 自己上传` / `DELETE 他人文档` 的 `write+` / `kb_admin` 判据）
- `prds/02-engineering/01-clhoria-template-alignment.md:110`（「权限码 + KB 行 role」）
- 以上均**未被任何后续 ADR 点名销账**；销账须 **ADR → 改 PRD → 升版本**，本图不得改 `prds/00–11`。

## 未做

- 未改 `prds/00–11` 任何一字
- 未改任何鉴权源码（见工单 05）
- 未给 `check.mjs` 的其余词表判定加测例
