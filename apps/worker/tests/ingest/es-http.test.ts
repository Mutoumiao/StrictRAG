/**
 * 目标：稀疏索引 HTTP 配置与对账不得静默错配。
 * 需求：OPS-1
 * 被测：esHttpConfigFromEnv · sparseTextForChunk · reconcileIndexed
 * 简介：空 URL 为 null；chunk 文本拼接；missing/orphan。
 */
import { describe, expect, it } from 'vitest';

import {
  esHttpConfigFromEnv,
  reconcileIndexed,
  sparseTextForChunk,
} from '../../src/ingest/es-http.js';

describe('esHttpConfigFromEnv', () => {
  it('null when URL empty', () => {
    expect(esHttpConfigFromEnv({ ELASTICSEARCH_URL: '' })).toBeNull();
  });

  it('defaults index', () => {
    expect(esHttpConfigFromEnv({ ELASTICSEARCH_URL: 'http://es:9200' })).toEqual({
      baseUrl: 'http://es:9200',
      index: 'strict_rag_dev',
    });
  });
});

describe('sparseTextForChunk', () => {
  it('joins prefix and body', () => {
    expect(sparseTextForChunk('title / section', '正文段落')).toBe('title / section\n正文段落');
  });

  it('body only when prefix empty', () => {
    expect(sparseTextForChunk('  ', '正文')).toBe('正文');
  });
});

describe('reconcileIndexed', () => {
  it('ok when sets match', () => {
    expect(reconcileIndexed(['c2', 'c1'], ['c1', 'c2']).ok).toBe(true);
  });

  it('reports missing and orphan', () => {
    const r = reconcileIndexed(['c1', 'extra'], ['c1', 'c2']);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['c2']);
    expect(r.orphan).toEqual(['extra']);
  });
});
