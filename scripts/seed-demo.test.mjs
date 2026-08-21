import assert from 'node:assert/strict';
import test from 'node:test';

import { inviteOk } from './seed-demo.mjs';

test('inviteOk accepts 200/201 and CONFLICT', () => {
  assert.equal(inviteOk(200, { ok: true }), true);
  assert.equal(inviteOk(201, { ok: true }), true);
  assert.equal(inviteOk(409, { error: { code: 'CONFLICT' } }), true);
  assert.equal(inviteOk(403, { error: { code: 'FORBIDDEN' } }), false);
});
