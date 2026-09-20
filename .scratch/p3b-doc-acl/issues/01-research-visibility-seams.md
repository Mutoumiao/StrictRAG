# 研究：可见性组装到底有几份、每份差在哪

Type: research
Status: claimed
Blocked by: —

## 问题

P3b 出口第 1 条（ADR-057 `prds/11-decisions/00-adr-index.md:1867`「列表预览、chunk 查看、ask evidence **同一可见性函数**」）要落到可执行的收敛方案，先得把**今天到底有几份组装、逐字差在哪**查清。已知至少五处：

| # | 入口 | 落点 |
|---|------|------|
| 1 | 文档列表 | `apps/api/src/routes/documents/index.ts:157-190` |
| 2 | 文档详情 / ACL 入口 | 同文件 `docReadDenied` `:818-860`（被 `:789-808` 与 `:879-886` 调用） |
| 3 | 分片预览 list/detail | `apps/api/src/routes/chunks.ts:61-105`（被 `:128-140`、`:164-180` 调用） |
| 4 | ask 语料装载 | `apps/api/src/services/retrieve/corpus.ts:76-98` |
| 5 | 是否有可检索文档 | 同文件 `hasRetrievableDocs:150-182` |

## 要回答

1. **逐字的相同 / 不同**：每处各自加载哪些 IO（`loadDeptAssignments` / `loadDeptNodes` / `loadDeptGrants` / 成员资格 / `DEPT_ACL_ENFORCE` / `deptInheritDown` / KB 覆盖）、调用哪个谓词（`isDocVisibleForDeptAcl` / `filterDocsForDeptAcl` / `isDocVisibleForAclPrincipals` / `filterDocsForAclPrincipals`）、**顺序**（先部门还是先 principals）、超管 bypass 的判定点、enforce 关时的短路。做成对照表，逐项标「相同 / 不同」。
2. **是否存在语义不等价**（不只是重复代码）：某处少了 grant 展开？某处顺序反了？`hasRetrievableDocs` 是不是放宽版近似拷贝？若有差异，指出**哪一侧才是 PRD 真值**（引 ADR-057 `:1852-1868` 与 ADR-009 `:147-158` 原文）。
3. **收敛的候选接缝**：理想签名（输入 ctx 含什么、输出是集合还是 bool）、IO 归属（谁负责 load）、能否复用请求级缓存（先例：`apps/api/src/auth/doc-scope.ts` 的 `createDocMemberGate` 用请求级 `Map` 缓存）。明确**哪些差异必须保留**（列表要 filter 出集合；详情只要 bool；分片要 403 文案）。
4. **回归面**：五处各自关联的既有测例文件清单（用于收敛后回归）。

## 约束

- 只读源码与测例，不改文件、不跑测试。
- 结论要能直接支撑决定票 `04-dec-visibility-function.md`。查不到就写「未找到」并列出查过的关键词与路径。

## Answer

（待填）
