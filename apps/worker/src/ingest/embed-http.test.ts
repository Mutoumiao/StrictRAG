import { describe, expect, it, vi } from 'vitest';

import { embedTextsHttp, mockEmbedVector } from './embed-http.js';

describe('mockEmbedVector', () => {
  it('stable dims', () => {
    const a = mockEmbedVector('chunk-a', 8);
    expect(a).toHaveLength(8);
    expect(mockEmbedVector('chunk-a', 8)).toEqual(a);
  });
});

describe('embedTextsHttp', () => {
  it('posts to /embeddings and returns vectors', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }] }),
    })) as unknown as typeof fetch;
    const out = await embedTextsHttp({
      baseUrl: 'http://gw/v1',
      apiKey: 'k',
      model: 'm',
      texts: ['a', 'b'],
      fetchImpl,
    });
    expect(out).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(fetchImpl).toHaveBeenCalled();
    const called = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0];
    expect(String(called)).toBe('http://gw/v1/embeddings');
  });

  it('empty baseUrl throws', async () => {
    await expect(
      embedTextsHttp({ baseUrl: '  ', apiKey: '', model: 'm', texts: ['a'] }),
    ).rejects.toThrow(/GATEWAY_BASE_URL/);
  });
});
