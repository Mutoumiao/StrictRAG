import { describe, expect, it } from 'vitest';

import {
  CreateModelProviderBodySchema,
  ModelProviderSchema,
  PatchModelProviderBodySchema,
  PutPlatformBindingsBodySchema,
  formatModelRef,
  parseModelRef,
  requiredModelTypeForPurpose,
} from './model-gateway.contract.js';

describe('model-gateway contracts (B3)', () => {
  it('Create body rejects empty models', () => {
    const r = CreateModelProviderBodySchema.safeParse({
      name: 'x',
      presetKey: 'custom',
      baseUrl: 'http://x',
      models: [],
    });
    expect(r.success).toBe(false);
  });

  it('Create body accepts apiKey only on write', () => {
    const r = CreateModelProviderBodySchema.safeParse({
      name: 'ds',
      presetKey: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'sk-secret',
      models: [{ name: 'deepseek-chat', type: 'llm', enabled: true }],
    });
    expect(r.success).toBe(true);
  });

  it('GET Provider schema has hasApiKey, not apiKey', () => {
    const r = ModelProviderSchema.safeParse({
      id: '01900000-0000-7000-8000-0000000000aa',
      name: 'ds',
      presetKey: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      timeoutMs: 60_000,
      enabled: true,
      models: [{ name: 'deepseek-chat', type: 'llm', enabled: true }],
      hasApiKey: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect('apiKey' in r.data).toBe(false);
      expect(r.data.hasApiKey).toBe(true);
    }
  });

  it('Patch strict rejects unknown fields', () => {
    const r = PatchModelProviderBodySchema.safeParse({ tauClaim: 0.5 });
    expect(r.success).toBe(false);
  });

  it('parse/format ModelRef', () => {
    const id = '01900000-0000-7000-8000-0000000000aa';
    const ref = formatModelRef(id, 'm1');
    expect(ref).toBe(`${id}#m1`);
    expect(parseModelRef(ref)).toEqual({ providerId: id, modelName: 'm1' });
    expect(parseModelRef('bad')).toBeNull();
  });

  it('requiredModelTypeForPurpose', () => {
    expect(requiredModelTypeForPurpose('embed')).toBe('embedding');
    expect(requiredModelTypeForPurpose('rerank')).toBe('rerank');
    expect(requiredModelTypeForPurpose('generate')).toBe('llm');
    expect(requiredModelTypeForPurpose('judge')).toBe('llm');
  });

  it('Put bindings body', () => {
    const id = '01900000-0000-7000-8000-0000000000aa';
    const r = PutPlatformBindingsBodySchema.safeParse({
      bindings: {
        generate: { primary: `${id}#chat` },
        embed: { primary: `${id}#emb`, fallbacks: [] },
      },
    });
    expect(r.success).toBe(true);
  });
});
