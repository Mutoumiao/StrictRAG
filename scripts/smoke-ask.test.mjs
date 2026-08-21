import assert from 'node:assert/strict';
import test from 'node:test';

import { askHasCitations, citationsFromAskEnvelope } from './smoke-ask.mjs';

test('empty / not-ok envelope has no citations', () => {
  assert.equal(askHasCitations(null), false);
  assert.equal(askHasCitations({ ok: false, data: { citations: [{ docId: 'x' }] } }), false);
  assert.equal(askHasCitations({ ok: true, data: { citations: [{ docId: 'x' }] } }), false);
  assert.equal(askHasCitations({ ok: true, data: { status: 'answered', citations: [] } }), false);
  assert.deepEqual(citationsFromAskEnvelope({ ok: true, data: {} }), []);
});

test('answered envelope with docId citations passes', () => {
  const json = {
    ok: true,
    data: {
      status: 'answered',
      citations: [{ chunkId: 'c1', docId: '01900000-0000-7000-8000-0000000000d1' }],
    },
  };
  assert.equal(askHasCitations(json), true);
  assert.equal(citationsFromAskEnvelope(json).length, 1);
});

test('citation without docId / non-object does not count', () => {
  assert.equal(
    askHasCitations({
      ok: true,
      data: { status: 'answered', citations: [{ chunkId: 'c1' }] },
    }),
    false,
  );
  assert.equal(
    askHasCitations({
      ok: true,
      data: { status: 'answered', citations: ['chunk-only'] },
    }),
    false,
  );
});

test('abstained or evidence-only envelope fails (user-visible citations required)', () => {
  assert.equal(
    askHasCitations({
      ok: true,
      data: {
        status: 'abstained',
        citations: [{ docId: '01900000-0000-7000-8000-0000000000d1' }],
      },
    }),
    false,
  );
  assert.equal(
    askHasCitations({
      ok: true,
      data: {
        status: 'answered',
        citations: [],
        evidence: [{ docId: '01900000-0000-7000-8000-0000000000d1' }],
      },
    }),
    false,
  );
});
