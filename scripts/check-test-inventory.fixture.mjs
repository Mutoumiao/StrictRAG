/**
 * 存货闸夹具。全部在临时目录布置，spawn(process.execPath, [闸], { cwd: tmp }).
 * 自身必须 exit 0。禁止往工作区写未登记 *.test.ts。
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const gatePath = fileURLToPath(new URL('./check-test-inventory.mjs', import.meta.url));

function runGate(cwd, extraEnv = {}) {
  return spawnSync(process.execPath, [gatePath], {
    cwd,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf8',
  });
}

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'inv-gate-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function write(root, rel, body = '// fixture\n') {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
}

test('缺 tests/index.md → exit 1', () => {
  withTmp((tmp) => {
    write(tmp, 'src/orphan.test.ts');
    const r = runGate(tmp);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /缺 tests\/index\.md/);
  });
});

test('src/ 或 tests/ 不存在 → 空集不红', () => {
  withTmp((tmp) => {
    write(tmp, 'tests/index.md', '# tmp\n\n`ask/` `prds/04-pipelines`\n');
    const r = runGate(tmp);
    assert.equal(r.status, 0, r.stderr);
  });
});

test('未登记 → 红 + 名单', () => {
  withTmp((tmp) => {
    write(tmp, 'tests/index.md', '# tmp\n');
    write(tmp, 'src/orphan.test.ts');
    const r = runGate(tmp);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /未登记:/);
    assert.match(r.stderr, /src\/orphan\.test\.ts/);
  });
});

test('假存货 → 红 + 名单', () => {
  withTmp((tmp) => {
    write(tmp, 'tests/index.md', '# tmp\n\n| 文件 |\n| `src/ghost.test.ts` |\n');
    const r = runGate(tmp);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /假存货:/);
    assert.match(r.stderr, /src\/ghost\.test\.ts/);
  });
});

test('../src/X ≡ src/X ；ask/X.test.ts ≡ tests/ask/X.test.ts', () => {
  withTmp((tmp) => {
    write(
      tmp,
      'tests/index.md',
      ['# tmp', '', '| 文件 |', '| `../src/graph/graph.test.ts` |', '| `ask/min-veto.test.ts` |', ''].join('\n'),
    );
    write(tmp, 'src/graph/graph.test.ts');
    write(tmp, 'tests/ask/min-veto.test.ts');
    const r = runGate(tmp);
    assert.equal(r.status, 0, r.stderr);
  });
});

test('Windows 反斜杠 ≡ posix', () => {
  withTmp((tmp) => {
    write(tmp, 'tests/index.md', '# tmp\n\n| 文件 |\n| `src\\lib\\http-error.test.ts` |\n');
    write(tmp, 'src/lib/http-error.test.ts');
    const r = runGate(tmp);
    assert.equal(r.status, 0, r.stderr);
  });
});

test('ask/、prds/… 忽略', () => {
  withTmp((tmp) => {
    write(
      tmp,
      'tests/index.md',
      [
        '# tmp',
        '',
        '`ask/` `prds/04-pipelines` `prds/08-quality` `tests/ask/` `runAskGraph`',
        '| `../src/env.test.ts` |',
        '',
      ].join('\n'),
    );
    write(tmp, 'src/env.test.ts');
    const r = runGate(tmp);
    assert.equal(r.status, 0, r.stderr);
  });
});

test('对齐 → exit 0；外部 ROOT 不影响 cwd', () => {
  withTmp((tmp) => {
    write(tmp, 'tests/index.md', '# tmp\n\n| `../src/time.test.ts` |\n');
    write(tmp, 'src/time.test.ts');
    const r = runGate(tmp, { ROOT: join(tmpdir(), 'not-the-package-root') });
    assert.equal(r.status, 0, r.stderr);
  });
});
