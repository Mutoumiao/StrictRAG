/**
 * 目标：非法 worker 栈环境组合不得通过启动校验。
 * 需求：基建: worker stackEnvIssues
 * 被测：stackEnvIssues
 * 简介：http 无 URL、s3 无 endpoint 失败；mock+local 与带 URL 的 http 合法。
 */
import { describe, expect, it } from 'vitest';

import { stackEnvIssues } from '../../src/env.js';

describe('stackEnvIssues', () => {
  it('http without URL fails', () => {
    const issues = stackEnvIssues({ INGEST_ES_MODE: 'http', ELASTICSEARCH_URL: '' });
    expect(issues.some((i) => i.path === 'INGEST_ES_MODE')).toBe(true);
  });

  it('s3 without endpoint fails', () => {
    const issues = stackEnvIssues({
      INGEST_ES_MODE: 'mock',
      STORAGE_MODE: 's3',
      S3_ENDPOINT: '',
    });
    expect(issues.some((i) => i.path === 'STORAGE_MODE')).toBe(true);
  });

  it('mock + local ok', () => {
    expect(
      stackEnvIssues({
        INGEST_ES_MODE: 'mock',
        STORAGE_MODE: 'local',
        ELASTICSEARCH_URL: '',
        S3_ENDPOINT: '',
      }),
    ).toEqual([]);
  });

  it('http with URL ok', () => {
    expect(
      stackEnvIssues({
        INGEST_ES_MODE: 'http',
        ELASTICSEARCH_URL: 'http://127.0.0.1:9200',
        STORAGE_MODE: 'local',
      }),
    ).toEqual([]);
  });
});
