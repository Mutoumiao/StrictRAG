/**
 * `git status --porcelain` 输出的路径解析。
 *
 * 行形态 = 两个状态字符 + 一个空格 + 路径：` M docs/a.md`（工作区改了已跟踪文件）、
 * `?? new/`（未跟踪）、`A  docs/b.md`（已暂存新增）、`R  old -> new`（重命名，取新路径）。
 *
 * 历史缺陷：旧实现用 `/^(?:.{1,2} |\?\?) (.*)$/`，要求状态字符后**两个**空格，于是只有
 * `?? path` 能匹配，` M path` 这类「已跟踪文件被改」永远解析不到 —— `check.mjs` 的变更联动
 * 检查据此判断「改了源码有没有改文档」，结果只看得见新增未跟踪文件，最常见的那一类反而漏判。
 */
export function parseGitStatusPaths(status) {
  const out = new Set();
  for (const line of status.split('\n')) {
    const m = /^.. (.*)$/.exec(line);
    const rest = m?.[1];
    if (rest === undefined || rest === '') continue;
    const renamed = /^.* -> (.*)$/.exec(rest);
    out.add((renamed?.[1] ?? rest).replace(/^"|"$/g, ''));
  }
  return out;
}
