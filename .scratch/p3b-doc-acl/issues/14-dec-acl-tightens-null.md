# 裁定：`aclTightens` 在 next 侧遇到 `null` 算不算收紧

Type: grilling
Status: resolved
Blocked by: 10

## 问题

`aclTightens(prev, next)`（`packages/contracts/src/ingest/document.contract.ts`）今天把 `next = null` 当成「空集合」处理 —— `[a] → null` 判 **true**（收紧）。但该函数的自带契约是「收紧 = 新集合不再是旧集合的**超集**（有人失去可读性）」，且同一段注释写「`null` = 字段缺失 = 该 KB **全体成员**可读」。两者矛盾：`[a] → null` 明明放宽到全体成员。

由工单 [10](./10-task-acl-tighten.md) 的测例口径断言挖出（原票面只写了「收紧 / 放宽」两侧，未覆盖 `[a] → null` 这一格）。

## Answer

**裁定：`next = null` **不是**收紧，`aclTightens` 应回 `false`。今天回 `true` 是与自身契约不一致的**误报**。**

### 1. 依据

1. **函数自带契约**（同文件 doc 注释）：「收紧判定：**新集合不再是旧集合的超集**（有人失去可读性）…`null` = 字段缺失 = 该 KB 全体成员可读；`[]` = 无人可读；非空 = 仅命中者可读」。按此读法 `null` 是**最宽**的一侧，故 `任何名单 → null` 恒为超集。
2. **既有真值表已按「null 最宽」写**：`packages/contracts/tests/ingest/document-contract.test.ts` 的 `aclTightens` 段把 `[] → null` 判 **false（放宽）**，而 `null → []` 判 true（收紧）。`[]` 与 `[a]` 都是「放宽到 null」，一个 false 一个 true **自相矛盾**；交集为空的那一格恰好是 `[a] → null`，即本票问的那格。
3. **形式证明（成员闸是外层）**：`null` 的有效可读集合 = 该 KB **全体成员**；`[a]` 的有效可读集合 = `{a} ∩ 成员`（文档入口先过 `createDocMemberGate` 的 KB 成员闸，再进可见性判定）。`{a} ∩ 成员 ⊆ 成员` 恒成立 ⇒ `[a] → null` **不可能有人失去可读性**。
4. **ADR-009 决策 4 的动机是泄漏侧**：「ACL 收紧须 reindex 后确认（最终一致）」针对的是「索引仍持旧（更宽）名单 ⇒ ES 可能召回已不可读的块」。放宽方向索引持旧（更窄）名单，只会少召回，不构成泄漏 —— 与「只加严」的动机同向。
5. **不选反向读法（把 `null` 当空集）的理由**：那要让 `[] → null` 也判 true，与既有真值表、`docs/module-status/contracts.md` 的记述、以及 `apps/api/tests/acl/documents-acl-endpoint.test.ts` 的「放宽不提示」用例同时冲突；且会让「字段缺失 = 成员可读」这条 P3b 语义在契约层被反读。

### 2. 落点

- `packages/contracts/src/ingest/document.contract.ts`：`aclTightens` 在 `previous !== null` 分支加 `if (upcoming === null) return false;`，并把「两侧都按 `null` = 全体成员归一」写进注释。
- `packages/contracts/tests/ingest/document-contract.test.ts`：真值表补 `[A] → null`、`[A, B] → null` 两行（放宽）。

### 3. 不放宽任何闸（逐条核对）

- `reindexRequired` 是**给运营的建议信号**，不是门禁：真正的可读性闸是 PG 谓词链（`visibility.ts` → `dept-acl` / `doc-acl`）与语料求交，二者**都不经此函数**，一格未动。
- **收紧侧判定一格未放宽**：`null → 非 null` 仍 true；非空 → 真子集 / 换人仍 true；`[] → []` / `null → null` 仍 false。
- 只在「next = null 的放宽」这一格清掉误报，即让信号回到它自己写下的定义（也正是 `docs/module-status/contracts.md` 已记述的读法）。

### 4. 边界 / 未验证

- 「`null` = 全体成员」这一读法**依赖成员闸在外层**。若将来把成员闸移进可见性函数内部，或允许 `aclPrincipals` 收非成员 uuid，本格需重议（`aclPrincipals` 今天是不带前缀的裸 uuid 数组，ADR-057 `:1861-1864` 要求的角色 principal 未落）。
- 真 ES 侧的映射/查询行为未验证（属 B8）。
