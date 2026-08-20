import { describe, expect, it } from 'vitest';

import { stackEnvIssues } from './env.js';

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
