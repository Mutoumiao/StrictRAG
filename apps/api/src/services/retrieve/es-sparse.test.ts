import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  EsSparseError,
  esConfigFromEnv,
  searchSparseEs,
} from './es-sparse.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('esConfigFromEnv', () => {
  it('null when URL empty', () => {
    expect(esConfigFromEnv({ ELASTICSEARCH_URL: '' })).toBeNull();
  });

  it('defaults index', () => {
    expect(esConfigFromEnv({ ELASTICSEARCH_URL: 'http://es:9200' })).toEqual({
      baseUrl: 'http://es:9200',
      index: 'strict_rag_dev',
    });
  });
});

describe('searchSparseEs', () => {
  it('returns ordered chunkIds from hits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          hits: {
            hits: [
              { _id: 'c1', _source: { chunkId: 'c1' } },
              { _id: 'c2', _source: { chunkId: 'c2' } },
            ],
          },
        }),
      })),
    );
    const ids = await searchSparseEs(
      { baseUrl: 'http://es:9200', index: 'strict_rag_dev' },
      { kbId: 'kb1', question: 'leave', size: 10 },
    );
    expect(ids).toEqual(['c1', 'c2']);
  });

  it('HTTP error → EsSparseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        text: async () => 'unavailable',
      })),
    );
    await expect(
      searchSparseEs(
        { baseUrl: 'http://es:9200', index: 'ix' },
        { kbId: 'k', question: 'q', size: 5 },
      ),
    ).rejects.toBeInstanceOf(EsSparseError);
  });
});
