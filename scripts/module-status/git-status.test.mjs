/**
 * 护 `git-status.mjs` 本身：变更联动的判据必须能看见「已跟踪文件被改」。
 * 历史缺陷：解析要求状态码后两个空格，导致 ` M path` 漏判（只认 `?? path`）。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { parseGitStatusPaths } from './git-status.mjs';

test('已跟踪文件被改（空格 + M + 空格）必须解析到', () => {
  const got = parseGitStatusPaths(' M docs/module-status/db.md\n');
  assert.deepEqual([...got], ['docs/module-status/db.md']);
});

test('未跟踪目录与文件解析到', () => {
  const got = parseGitStatusPaths('?? .scratch/effort/\n?? packages/db/tests/migrations/\n');
  assert.deepEqual([...got].sort(), ['.scratch/effort/', 'packages/db/tests/migrations/']);
});

test('已暂存新增与重命名取新路径', () => {
  const got = parseGitStatusPaths('A  docs/new.md\nR  docs/old.md -> docs/renamed.md\n');
  assert.deepEqual([...got], ['docs/new.md', 'docs/renamed.md']);
});

test('空输出与尾部换行不产生条目', () => {
  assert.deepEqual([...parseGitStatusPaths('')], []);
  assert.deepEqual([...parseGitStatusPaths('\n')], []);
});
