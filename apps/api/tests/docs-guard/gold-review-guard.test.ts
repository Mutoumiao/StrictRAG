/**
 * 目标：黄金集名录（fixtures/l1|2/gold.yaml）只认人审后手工维护，不得存在「运营点一下即写文件」的代码路径。
 * 需求：剧本 G3 · prds/10-delivery/03-acceptance-scenarios.md · ADR-019 · 功能表 §4.1
 * 被测：apps 各包 src 与 packages 各包 src 的源码护栏（读仓库文件，非 mock）
 * 简介：凡提到 gold.yaml 的源码文件都不得同时出现写文件 API；运营纳入走 gold_questions 表（另见 feedback/promote-gold.test.ts）。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');

const WRITE_APIS = [
  'writeFileSync',
  'appendFileSync',
  'createWriteStream',
  'writeFile(',
  'rmSync',
  'unlinkSync',
  'renameSync',
];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

function srcRoots(): string[] {
  const roots: string[] = ['apps/api', 'apps/worker', 'apps/admin', 'apps/web', 'packages'].map(
    (p) => join(repoRoot, p),
  );
  const files: string[] = [];
  for (const root of roots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    if (root.endsWith('packages')) {
      for (const pkg of entries) files.push(...collectSourceFiles(join(root, pkg, 'src')));
    } else {
      files.push(...collectSourceFiles(join(root, 'src')));
    }
  }
  return files;
}

describe('剧本 G3 · 黄金集文件写路径护栏', () => {
  it('凡提到 gold.yaml 的源码，写文件 API 附近都不得出现该名录路径', () => {
    const mentioning = srcRoots().filter((f) => /gold\.yaml/.test(readFileSync(f, 'utf8')));

    // 护栏不是空转：仓内确有读侧引用
    expect(mentioning.length).toBeGreaterThan(0);

    for (const file of mentioning) {
      const text = readFileSync(file, 'utf8');
      for (const api of WRITE_APIS) {
        let idx = text.indexOf(api);
        while (idx >= 0) {
          const window = text.slice(Math.max(0, idx - 200), idx + 200);
          expect(/gold\.ya?ml/i.test(window), `${file} 的 ${api} 附近出现 gold.yaml`).toBe(false);
          idx = text.indexOf(api, idx + 1);
        }
      }
    }
  });

  it('L1 名录只有读侧入口（路径常量），且运营纳入落 gold_questions 表', () => {
    const l1Loader = readFileSync(
      join(repoRoot, 'apps/api/src/scripts/run-l1-golden.ts'),
      'utf8',
    );
    expect(l1Loader).toContain("fixtures/l1/gold.yaml");
    expect(l1Loader).toContain('loadGold');

    // 审核后纳入的落点是 DB 表，不是文件账本
    const table = readFileSync(
      join(repoRoot, 'packages/db/src/schema/ask/gold-questions.ts'),
      'utf8',
    );
    expect(table).toContain('goldQuestions');
  });
});
