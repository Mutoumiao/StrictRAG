# @strict-rag/db · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：schema 与纯查询辅助。检索装载生产路径在 api（P0 R7 主锚不是这里）。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `ask/` | ask 相关表形状 | `prds/03-data` |
| `ingest/` | 文档/部门列 | P3b-META |
| `acl/` | 跨部门 grant 表 | DEPT_ACL |
| `retrieve/` | ready∧active 纯函数 | 质量红线；R7 附录 |
| `env/` | 写库时间格式 | ORM PRD |

## 测例

（尚无 `tests/<能力>/` 现行文件。）

## 遗留（待迁）

| 文件 | 目标 | 需求锚点 | 简介 | 状态 |
|------|------|----------|------|------|
| `../src/time.test.ts` | 写库时间本地格式串 | `prds/02-engineering/02-orm-drizzle.md` | | 遗留 |
| `../src/query/retrieval-gate.test.ts` | isDefaultRetrievable = ready∧active | 双就绪闸 | **附录**；R7 主锚 api corpus | 遗留 |
| `../src/schema/ask/ask-schema.test.ts` | ask_sessions/traces/feedback/eval_runs 列 | `prds/03-data` | | 遗留 |
| `../src/schema/kb/documents.schema.test.ts` | 文档表含部门/可见级列 | P3b-META | 强制未接 | 遗留 |
| `../src/schema/system/dept-cross-grants.schema.test.ts` | grant 表形状 | DEPT_ACL | | 遗留 |
