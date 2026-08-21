import { describe, expect, it } from 'vitest';

import {
  findDocumentBody,
  localMongoDocId,
  pingMongo,
  upsertDocumentBody,
} from './mongo-body.js';

describe('mongo-body', () => {
  it('local id prefix', () => {
    expect(localMongoDocId('doc-1')).toBe('local:doc-1');
  });

  it('empty url returns local id without connecting', async () => {
    const id = await upsertDocumentBody({
      url: '  ',
      docId: 'd1',
      kbId: 'k1',
      text: 'hello',
    });
    expect(id).toBe('local:d1');
  });

  it('findDocumentBody empty url returns null without connecting', async () => {
    await expect(findDocumentBody({ url: '  ', docId: 'd1' })).resolves.toBeNull();
  });

  it('pingMongo empty url returns false without connecting', async () => {
    await expect(pingMongo('  ')).resolves.toBe(false);
  });
});
