import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { ADMIN_DEV_LOGIN_OK_STATUS, assertOk, inviteOk } from './seed-demo.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('inviteOk accepts 200/201 and CONFLICT', () => {
  assert.equal(inviteOk(200, { ok: true }), true);
  assert.equal(inviteOk(201, { ok: true }), true);
  assert.equal(inviteOk(409, { error: { code: 'CONFLICT' } }), true);
  assert.equal(inviteOk(403, { error: { code: 'FORBIDDEN' } }), false);
});

test('dev-login assertOk follows auth.ts 201; expecting 200 fails', () => {
  const authSrc = readFileSync(path.join(repoRoot, 'apps/api/src/routes/auth.ts'), 'utf8');
  assert.match(authSrc, /return ok\(c, pair as TokenPairResponse, 201\)/);
  assert.equal(ADMIN_DEV_LOGIN_OK_STATUS, 201);
  const loginRes = { status: 201, json: { ok: true, data: { accessToken: 't' } } };
  assert.throws(
    () => assertOk('dev-login', loginRes, 200),
    /dev-login: HTTP 201/,
  );
  assert.doesNotThrow(() => assertOk('dev-login', loginRes, ADMIN_DEV_LOGIN_OK_STATUS));
});
