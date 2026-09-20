# 回写：读面成员闸的规范与镜像

Type: task
Status: resolved
Blocked by: 03

## 目标

实现落地后按权威分层回写**四处**，每处都指到源码：

1. `.trellis/spec/api/backend/auth-authorization.md`：把「路径只有 `:docId` 的写入口必须补成员闸」一节扩成**读写同节**（现文只写写面），补上共享模块 `auth/` 的落点与 `posture` 规则；说明「读面姿态随码」与顺序（成员闸 → 部门/名单）。
2. `docs/module-status/api.md`：「鉴权与权限」节补读面 5 个入口已挂闸；**并改写现有边界句**——`GET …/acl` 那条「PUT 刻意不叠可见性闸」需与读面成员闸区分开（前者指 `docReadDenied`，后者是新闸，两者不是同一道）。
3. `docs/testing/coverage/02-acl.md` 口径注 + 若 `S3` / `S5` 行的「缺口」列受本图影响，须如实更新（**S3 是码表口径冲突，本图不动码表 → 若仍冲突就必须保持「部分测」，禁止顺手判成已解**）。
4. `.scratch/doc-read-member-gate/map.md` 的 Decisions / 前沿；`docs/module-status/README.md` 若矩阵行受影响则同改。

## 硬门

- 跑 `pnpm check:module-status`，**本图新增文本不得带出新的误报条目**（前图教训：`FORBIDDEN` 与裸词 `reindex` / `lifecycle` / `doc` 会被脚本误判为符号 / 表名 → 写法上避开）
- **收口复核在最后一次提交之后**跑（前图教训：检查早于收尾提交会让「已清零」的结论被自己的提交推翻）
- 回写必须能在源码里指到证据路径；不得用 task 叙事抬成熟度
