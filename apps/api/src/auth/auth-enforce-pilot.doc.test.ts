import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('HALF-AUTHDOC pilot recipe', () => {
  it('tells how to open AUTH_ENFORCE locally without changing example default', () => {
    const md = readFileSync(path.join(repoRoot, 'docs/ops/auth-enforce-pilot.md'), 'utf8');
    expect(md).toMatch(/不改仓库默认/);
    expect(md).toMatch(/AUTH_ENFORCE=true/);
    expect(md).toMatch(/dev-login/);
    const example = readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
    expect(example).toMatch(/^AUTH_ENFORCE=false$/m);
  });
});
