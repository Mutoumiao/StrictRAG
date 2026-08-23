/**
 * 目标：交付控制台 §0.5 已闭合待盘点行不得回退。
 * 需求：交付控制台
 * 被测：prds/12-delivery-guides/04-交付控制台.md
 * 简介：读 PRD 文件，非 mock。
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(here, '../../../..');
const consolePath = resolve(
  monorepoRoot,
  'prds/12-delivery-guides/04-交付控制台.md',
);

/** 2026-08-13 闭合的待盘点行号 */
const CLOSED_ROWS = [7, 17, 20, 30, 31, 32, 33, 34] as const;

function tableLineForRow(md: string, row: number): string | undefined {
  const re = new RegExp(`^\\|\\s*${row}\\s*\\|`, 'm');
  return md.split(/\r?\n/).find((line) => re.test(line));
}

describe('交付 §0.5 待盘点闭合护栏', () => {
  it('目标 8 行存在且 backlog 列不含「待盘点」', () => {
    const md = readFileSync(consolePath, 'utf8');
    expect(md.length).toBeGreaterThan(100);

    for (const row of CLOSED_ROWS) {
      const line = tableLineForRow(md, row);
      expect(line, `missing §0.5 row #${row}`).toBeDefined();
      // backlog/证据列在第 4 段；整行禁止回退「待盘点」标签
      expect(line, `row #${row} still 待盘点: ${line}`).not.toMatch(/\*\*待盘点\*\*|待盘点/);
    }

    expect(md).toMatch(/待盘点行计数[\s\S]{0,80}\*\*0 行\*\*/);
  });
});
