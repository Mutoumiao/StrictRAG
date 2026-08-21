/**
 * HALF-EMBED：http 模式走 OpenAI 兼容 /v1/embeddings。默认仍 mock。
 * worker 禁止 import apps/api。
 */
export function mockEmbedVector(chunkId: string, dims: number): number[] {
  return Array.from({ length: dims }, (_, i) => ((chunkId.charCodeAt(i % chunkId.length) ?? 1) % 97) / 97);
}

export async function embedTextsHttp(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  texts: string[];
  fetchImpl?: typeof fetch;
}): Promise<number[][]> {
  if (!opts.baseUrl.trim()) {
    throw new Error('GATEWAY_BASE_URL required for INGEST_EMBED_MODE=http');
  }
  if (opts.texts.length === 0) return [];
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(`${opts.baseUrl.replace(/\/$/, '')}/embeddings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}),
    },
    body: JSON.stringify({ model: opts.model, input: opts.texts }),
  });
  if (!res.ok) {
    throw new Error(`embed HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data?: { embedding?: number[] }[] };
  const vectors = (json.data ?? []).map((d) => d.embedding ?? []);
  if (vectors.length !== opts.texts.length || vectors.some((v) => v.length === 0)) {
    throw new Error('embed: incomplete vectors');
  }
  return vectors;
}
