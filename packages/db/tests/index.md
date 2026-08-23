# @strict-rag/db · 测试导航

> HOW：`.trellis/spec/guides/testing.md`  
> 本包主责：schema 与纯查询辅助。检索装载生产路径在 api（P0 R7 主锚不是这里）。  
> **存货不是覆盖。** 本表只登记本包 `src/` 与 `tests/` 下的 `*.test.ts(x)`；漏行即红。测全了没有看 `docs/testing/p0-redlines.md` 与验收剧本。

## 能力

| 目录 | 能力 | 需求锚点 |
|------|------|----------|
| `ask/` | ask 相关表形状 | `prds/03-data` |
| `ingest/` | 文档/部门列 | P3b-META |
| `acl/` | 跨部门 grant 表 | DEPT_ACL |
| `retrieve/` | ready∧active 纯函数 | 质量红线；R7 附录 |
| `env/` | 写库时间格式 | ORM PRD |

## 测例

| 文件 | 目标 | 需求锚点 | 被测 | 简介 | 状态 |
|------|------|----------|------|------|------|
| `acl/dept-grants-schema.test.ts` | 跨部门 grant 表必须暴露授权列，形状与 user+dept 唯一约束字段对齐。 | DEPT_ACL | `deptCrossGrants` | 核对 grant 列名与形状。 | 现行 |
| `ask/ask-schema.test.ts` | ask_sessions / traces / feedback / eval_runs 必须可导出且含会话与证据快照列。 | prds/03-data | `users · kbMembers · askSessions · askTraces · askFeedback · evalRuns` | 核对 Phase 2 ask 表导出与关键列。 | 现行 |
| `env/local-datetime.test.ts` | 写库时间必须是本地 yyyy-MM-dd HH:mm:ss 格式串，失败则 ORM 时间契约不成立。 | prds/02-engineering/02-orm-drizzle.md | `formatLocalDateTime` | 断言输出形状为本地日期时间串。 | 现行 |
| `ingest/documents-schema.test.ts` | 文档表必须含部门与可见级列，且 id / 时间列策略不变。 | P3b-META | `documents` | 核对 ownerDeptId / visibilityLevel 及本地时间、uuid；强制未接。 | 现行 |
| `retrieve/ready-active-gate.test.ts` | 默认检索闸只放行 ready∧active，其它状态或生命周期不得进入默认检索集。 | 双就绪闸（P0 R7 附录；主锚在 api corpus） | `isDefaultRetrievable · filterDefaultRetrievable` | 纯函数过滤；R7 生产路径在 api。 | 现行 |

## 待处理

（无。`src/` 下已无 `*.test.ts(x)`。）
