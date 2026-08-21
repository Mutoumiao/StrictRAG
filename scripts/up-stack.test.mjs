import assert from 'node:assert/strict';
import test from 'node:test';

import { appFilters, composeArgs, pnpmStartArgs, stackFailed } from './up-stack.mjs';

test('composeArgs pins repo compose file', () => {
  assert.deepEqual(composeArgs(), ['compose', '-f', 'docker/docker-compose.yml', 'up', '-d']);
});

test('appFilters are api then worker only', () => {
  assert.deepEqual(appFilters(), ['@strict-rag/api', '@strict-rag/worker']);
  assert.equal(appFilters().includes('@strict-rag/web'), false);
  assert.equal(appFilters().includes('@strict-rag/admin'), false);
});

test('pnpmStartArgs is filter + start', () => {
  assert.deepEqual(pnpmStartArgs('@strict-rag/api'), ['--filter', '@strict-rag/api', 'start']);
  assert.deepEqual(pnpmStartArgs('@strict-rag/worker'), ['--filter', '@strict-rag/worker', 'start']);
});

test('stackFailed is true iff any child code is non-zero', () => {
  assert.equal(stackFailed([0, 0]), false);
  assert.equal(stackFailed([0, 1]), true);
  assert.equal(stackFailed([1, 0]), true);
  assert.equal(stackFailed([1, 1]), true);
});
