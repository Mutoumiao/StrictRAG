/**
 * L2 多轮题面加载与类型覆盖（纯函数）。
 * 不调用 executeAsk，不写 eval_runs，不读 SESSION_REWRITE_ENABLED。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const L2_TYPES = [
  'near_coref',
  'weak_coref',
  'explicit_backref',
  'topic_switch',
  'kb_conflict',
  'adversarial',
  'no_session',
  'budget',
  'session_isolation',
] as const;

export type L2Type = (typeof L2_TYPES)[number];

export const L2_SESSION_REFS = ['same', 'new', 'none'] as const;
export type L2SessionRef = (typeof L2_SESSION_REFS)[number];

export const L2_ACCEPT = ['answered', 'abstained', 'coref_unresolved', 'budget_exhausted'] as const;
export type L2Accept = (typeof L2_ACCEPT)[number];

export const L2_J_SCENARIOS = ['J1', 'J2', 'J2x', 'J3', 'J4', 'J5', 'J6', 'J8'] as const;
export type L2JScenario = (typeof L2_J_SCENARIOS)[number];

export type L2Turn = {
  role: 'user';
  text: string;
  session: L2SessionRef;
};

export type L2Expected = {
  themePersist: boolean;
  historyInEvidence: false;
  rewriteUsed: boolean;
  accept: L2Accept[];
};

export type L2Case = {
  id: string;
  type: L2Type;
  jScenario?: L2JScenario;
  turns: L2Turn[];
  expected: L2Expected;
  expectedDocIds?: string[];
  rubric: string;
};

export type L2GoldFile = {
  version: 1;
  run_type: 'session_multiturn';
  description: string;
  signoffEligible: false;
  cases: L2Case[];
};

export class L2GoldLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'L2GoldLoadError';
  }
}

const L2_TYPE_SET = new Set<string>(L2_TYPES);
const L2_SESSION_SET = new Set<string>(L2_SESSION_REFS);
const L2_ACCEPT_SET = new Set<string>(L2_ACCEPT);
const L2_J_SET = new Set<string>(L2_J_SCENARIOS);
const L2_ID_RE = /^l2-[a-z0-9-]+$/;

export function resolveRepoRoot(fromFile = import.meta.url): string {
  // apps/api/src/eval → 仓根
  return path.resolve(path.dirname(fileURLToPath(fromFile)), '../../../..');
}

export function defaultL2GoldPath(repoRoot = resolveRepoRoot()): string {
  return path.join(repoRoot, 'fixtures/l2/gold.yaml');
}

export function l2TypeCoverage(cases: ReadonlyArray<{ type: L2Type }>): {
  present: Set<L2Type>;
  missing: L2Type[];
} {
  const present = new Set<L2Type>();
  for (const c of cases) present.add(c.type);
  const missing = L2_TYPES.filter((t) => !present.has(t));
  return { present, missing };
}

export function loadL2Gold(goldPath: string): L2GoldFile {
  let raw: string;
  try {
    raw = readFileSync(goldPath, 'utf8');
  } catch (err) {
    throw new L2GoldLoadError(`cannot read gold file: ${goldPath}: ${(err as Error).message}`);
  }

  let data: unknown;
  try {
    // gold.yaml 内容为 JSON 形（零 yaml 依赖）；.json 亦可
    data = JSON.parse(raw);
  } catch (err) {
    throw new L2GoldLoadError(`invalid gold JSON in ${goldPath}: ${(err as Error).message}`);
  }

  if (!data || typeof data !== 'object') {
    throw new L2GoldLoadError('gold root must be object');
  }

  const root = data as Record<string, unknown>;
  if (root.version !== 1) {
    throw new L2GoldLoadError('gold.version must be 1');
  }
  if (root.run_type !== 'session_multiturn') {
    throw new L2GoldLoadError('gold.run_type must be session_multiturn');
  }
  if (typeof root.description !== 'string' || !root.description) {
    throw new L2GoldLoadError('gold.description required string');
  }
  if (root.signoffEligible !== false) {
    throw new L2GoldLoadError('gold.signoffEligible must be false');
  }
  if (!Array.isArray(root.cases) || root.cases.length === 0) {
    throw new L2GoldLoadError('gold.cases must be a non-empty array');
  }

  const seen = new Set<string>();
  const cases: L2Case[] = [];
  for (let i = 0; i < root.cases.length; i++) {
    cases.push(parseCase(root.cases[i], i, seen));
  }

  return {
    version: 1,
    run_type: 'session_multiturn',
    description: root.description,
    signoffEligible: false,
    cases,
  };
}

function parseCase(raw: unknown, index: number, seen: Set<string>): L2Case {
  if (!raw || typeof raw !== 'object') {
    throw new L2GoldLoadError(`cases[${index}] must be object`);
  }
  const row = raw as Record<string, unknown>;
  const id = row.id;
  if (typeof id !== 'string' || !id || !L2_ID_RE.test(id)) {
    throw new L2GoldLoadError(`cases[${index}].id must match /^l2-[a-z0-9-]+$/`);
  }
  if (seen.has(id)) {
    throw new L2GoldLoadError(`duplicate id: ${id}`);
  }
  seen.add(id);

  const type = row.type;
  if (typeof type !== 'string' || !L2_TYPE_SET.has(type)) {
    throw new L2GoldLoadError(
      `cases[${index}].type must be one of ${L2_TYPES.join('|')}`,
    );
  }
  const l2Type = type as L2Type;

  const turns = parseTurns(row.turns, index, l2Type);
  const expected = parseExpected(row.expected, index, l2Type);

  if (l2Type === 'session_isolation' && !turns.some((t) => t.session === 'new')) {
    throw new L2GoldLoadError(`cases[${index}] session_isolation requires at least one session=new`);
  }

  const out: L2Case = {
    id,
    type: l2Type,
    turns,
    expected,
    rubric: parseRubric(row.rubric, index),
  };

  if (row.jScenario !== undefined) {
    if (typeof row.jScenario !== 'string' || !L2_J_SET.has(row.jScenario)) {
      throw new L2GoldLoadError(
        `cases[${index}].jScenario must be one of ${L2_J_SCENARIOS.join('|')}`,
      );
    }
    out.jScenario = row.jScenario as L2JScenario;
  }

  if (row.expectedDocIds !== undefined) {
    out.expectedDocIds = parseDocIds(row.expectedDocIds, index);
  }

  return out;
}

function parseTurns(raw: unknown, index: number, type: L2Type): L2Turn[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new L2GoldLoadError(`cases[${index}].turns must be a non-empty array`);
  }
  if (type !== 'no_session' && raw.length < 2) {
    throw new L2GoldLoadError(`cases[${index}].turns length must be ≥2 when type≠no_session`);
  }

  const turns: L2Turn[] = [];
  for (let j = 0; j < raw.length; j++) {
    const t = raw[j];
    if (!t || typeof t !== 'object') {
      throw new L2GoldLoadError(`cases[${index}].turns[${j}] must be object`);
    }
    const row = t as Record<string, unknown>;
    if (row.role !== 'user') {
      throw new L2GoldLoadError(`cases[${index}].turns[${j}].role must be user`);
    }
    if (typeof row.text !== 'string' || !row.text.trim()) {
      throw new L2GoldLoadError(`cases[${index}].turns[${j}].text required non-empty string`);
    }
    if (typeof row.session !== 'string' || !L2_SESSION_SET.has(row.session)) {
      throw new L2GoldLoadError(
        `cases[${index}].turns[${j}].session must be same|new|none`,
      );
    }
    if (type === 'no_session' && row.session !== 'none') {
      throw new L2GoldLoadError(
        `cases[${index}] no_session requires session=none (turns[${j}].session=${row.session})`,
      );
    }
    turns.push({
      role: 'user',
      text: row.text,
      session: row.session as L2SessionRef,
    });
  }
  return turns;
}

function parseExpected(raw: unknown, index: number, type: L2Type): L2Expected {
  if (!raw || typeof raw !== 'object') {
    throw new L2GoldLoadError(`cases[${index}].expected must be object`);
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.themePersist !== 'boolean') {
    throw new L2GoldLoadError(`cases[${index}].expected.themePersist must be boolean`);
  }
  if (row.historyInEvidence !== false) {
    throw new L2GoldLoadError(`cases[${index}].expected.historyInEvidence must be false`);
  }
  if (typeof row.rewriteUsed !== 'boolean') {
    throw new L2GoldLoadError(`cases[${index}].expected.rewriteUsed must be boolean`);
  }
  if (type === 'no_session' && row.rewriteUsed !== false) {
    throw new L2GoldLoadError(`cases[${index}] no_session requires expected.rewriteUsed=false`);
  }
  if (!Array.isArray(row.accept) || row.accept.length === 0) {
    throw new L2GoldLoadError(`cases[${index}].expected.accept must be a non-empty array`);
  }
  const accept: L2Accept[] = [];
  for (let k = 0; k < row.accept.length; k++) {
    const a = row.accept[k];
    if (typeof a !== 'string' || !L2_ACCEPT_SET.has(a)) {
      throw new L2GoldLoadError(
        `cases[${index}].expected.accept[${k}] must be one of ${L2_ACCEPT.join('|')}`,
      );
    }
    accept.push(a as L2Accept);
  }
  return {
    themePersist: row.themePersist,
    historyInEvidence: false,
    rewriteUsed: row.rewriteUsed,
    accept,
  };
}

function parseRubric(raw: unknown, index: number): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new L2GoldLoadError(`cases[${index}].rubric required non-empty string`);
  }
  return raw;
}

function parseDocIds(raw: unknown, index: number): string[] {
  if (!Array.isArray(raw)) {
    throw new L2GoldLoadError(`cases[${index}].expectedDocIds must be string[]`);
  }
  const ids: string[] = [];
  for (let k = 0; k < raw.length; k++) {
    const id = raw[k];
    if (typeof id !== 'string' || !id) {
      throw new L2GoldLoadError(`cases[${index}].expectedDocIds[${k}] must be non-empty string`);
    }
    ids.push(id);
  }
  return ids;
}
