# 03 · task：修 `check.mjs` 的 porcelain 解析（改了源码看不见）——旁路发现

Type: task
Status: resolved
Blocked by: 无（核实工单 02 收口时发现）

## 触发

本图收口要复跑 `pnpm check:module-status`，结果冒出一条 `6-联动`：「改 `packages/db/*` 未改 `docs/module-status/db.md`」——但 `git status` 明明显示 `docs/module-status/db.md` **已改**。判据与事实矛盾，必须查清，不能当噪声略过。

## 根因（已实证）

`scripts/module-status/check.mjs` 的 `checkDrift()` 用：

```js
const m = line.match(/^(?:.{1,2} |\?\?) (.*)$/);
```

该正则要求状态字符后**两个**空格。而 `git status --porcelain` 的形态是**两个状态字符 + 一个空格 + 路径**：

| 行 | 形态 | 旧正则 |
|----|------|--------|
| ` M docs/module-status/db.md` | 空格 + `M` + 空格 + 路径（3 字符后即路径） | **不匹配** |
| `?? .scratch/effort/` | `?` + `?` + 空格 + 路径 | 匹配 |

于是 `changed` 集合**只装得进未跟踪路径，装不进被修改的已跟踪路径**。后果是双向的：

- **假阳性**（本次撞上）：`docTouched` 恒为假 → 只要包里出现任何未跟踪文件（新迁移、新测例目录），就报「未改文档」，哪怕文档确实改了。
- **假阴性**（更严重）：只改已跟踪源码、不动文档——**最常见的那类漂移**——`touched` 恒为假，一律漏判。也就是说这条门禁长期只见「新增文件」这一类漂移。

原始证据：`.scratch/migration-default-parity/probe.json`（`git status` 原文，纯 LF，排除 CRLF 干扰）。

## 修法

抽出解析函数并加回归护栏：

- 新增 `scripts/module-status/git-status.mjs`：`parseGitStatusPaths(status)`，正则改为 `/^.. (.*)$/`（对 ` M path`、`?? path`、`A  path` 三种形态都正确），并处理重命名 `R  old -> new` 取**新路径**。
- `check.mjs` 的 `checkDrift()` 改为调用它（`import { parseGitStatusPaths } from './git-status.mjs'`）。
- 新增 `scripts/module-status/git-status.test.mjs`（`node --test`，4 例），第一例即钉死「已跟踪文件被改必须解析到」。
- `docs/testing/README.md` 的「仓库脚本」表登记该测例，并把「护 `scripts/*.mjs`」一句补上子目录。

## 验证（实测）

| 观察 | 命令 | 结果 |
|------|------|------|
| 回归测例 | `node --test scripts/module-status/git-status.test.mjs` | **4 passed / 0 failed** |
| 修后：文档已改 | `node .scratch/migration-default-parity/probe.mjs -current` | **`6-联动` = 0 条**（原为假阳性 1 条）；总数 39 = `2-env` + `3-符号` 13 + `5-表` 24 |
| 修后：文档未改（临时还原 `db.md` 到 HEAD，量完即还原） | `node .scratch/migration-default-parity/probe.mjs -baseline` | **`6-联动` = 1 条**（真阳性，符合预期）；总数 37 |

即：同一条判据在「文档改了 / 没改」两侧分别给出 0 / 1，方向正确。

## 顺带量出的基线（HEAD）

`2-env` 2 + `3-符号` 13 + `5-表` 21 = **36 条**（与上一轮收口记录一致，`6-联动` 在 HEAD 也为 0，因为当时工作区干净）。

本图改动后 `5-表` 由 21 增至 24，逐条差异为：`conflict_pairs` ×2、`cross_doc_dropped` ×1——全部来自 `db.md` 里给这两个**物理列名**加反引号。该类条目原文即为「db schema 表清单中不存在（可能为字段/状态词，可加入黑名单）」，基线 21 条中已有 `dedupe_status` / `active_index_version` / `visibility_level` / `acl_principals` / `duplicate_of` / `dedupe_cross_doc_rate` 等同类列名，故属**同类预期增量**，不改写措辞去凑数，只如实记录差异。

## 未做

- 未给 `check.mjs` 的其余检查（`3-符号` / `5-表` 的词表判定）加测例——本工单只护被修的那一处解析。
