# 06 · task：回写（spec / module-status / coverage / 债）

Type: task
Status: open
Blocked by: 04（若裁定为 B，则本工单是唯一落地工单）

## 做什么

把工单 04 的裁定写回三处镜像 + 规范，使下次核查能直接引用：

| 落点 | 写什么 |
|------|--------|
| `.trellis/spec/api/backend/auth-authorization.md` | KB 内授权的判据（成员资格 + 码，role 的地位），以及若落地了 role 闸则写明落点与姿态 |
| `docs/module-status/api.md` | 边界句 + `最近更新` 追加当日条目（写清做了什么 / 未做什么） |
| `docs/module-status/db.md` | `kb_members.role` 的地位（锚点还是判据） |
| `docs/testing/coverage/02-acl.md` | `S5` 行的「缺口」列按裁定改写；若因此消除残留 → 行级覆盖状态同步改，并核对分册计数段 |
| `.scratch/kb-role-vs-code/map.md` | Notes 里记「须 ADR 才能销账的冻结核查债」（若裁定为 B） |

## 纪律

- `prds/00–11` 一个字不改。
- 覆盖表改行状态必须**同时**核对表头计数与分册计数段（前图吃过这亏：计数段与行级不一致）。
- 收口后在**最后一次提交之后**复跑 `pnpm check:module-status`，把条数记进 map。

## 验收

四处镜像与裁定一致，无自相矛盾；`pnpm check:module-status` 在最后一次提交之后复跑通过；条数写入 map。
