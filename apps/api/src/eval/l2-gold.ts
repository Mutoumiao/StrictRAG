/**
 * L2 题面加载：解析下沉 @strict-rag/contracts；本文件保留 fs 路径给 CLI。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { L2GoldLoadError, parseL2Gold, type L2GoldFile } from '@strict-rag/contracts';

export {
  L2_ACCEPT,
  L2_J_SCENARIOS,
  L2_SESSION_REFS,
  L2_SIGNOFF_MIN_CASES,
  L2_TYPES,
  L2GoldLoadError,
  l2TypeCoverage,
  parseL2Gold,
  type L2Accept,
  type L2Case,
  type L2Expected,
  type L2GoldFile,
  type L2JScenario,
  type L2SessionRef,
  type L2Turn,
  type L2Type,
} from '@strict-rag/contracts';

export function resolveRepoRoot(fromFile = import.meta.url): string {
  return path.resolve(path.dirname(fileURLToPath(fromFile)), '../../../..');
}

export function defaultL2GoldPath(repoRoot = resolveRepoRoot()): string {
  return path.join(repoRoot, 'fixtures/l2/gold.yaml');
}

export function loadL2Gold(goldPath: string): L2GoldFile {
  let raw: string;
  try {
    raw = readFileSync(goldPath, 'utf8');
  } catch (err) {
    throw new L2GoldLoadError(`cannot read gold file: ${goldPath}: ${(err as Error).message}`);
  }
  try {
    return parseL2Gold(JSON.parse(raw));
  } catch (err) {
    if (err instanceof L2GoldLoadError) throw err;
    throw new L2GoldLoadError(`invalid gold JSON in ${goldPath}: ${(err as Error).message}`);
  }
}
