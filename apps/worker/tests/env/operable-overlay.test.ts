/**
 * 目标：operable overlay 与 .env.example 叠加后栈组合必须合法。
 * 需求：OPS-STACK
 * 被测：parseEnvAssignments · stackEnvIssues
 * 简介：解析赋值跳过注释；example 与 overlay last-wins 对齐 docker 骨架。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stackEnvIssues } from '../../src/env.js';
import { parseEnvAssignments } from '../../src/operable-env.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function stackInput(vars: Record<string, string>) {
  return {
    INGEST_ES_MODE: vars.INGEST_ES_MODE ?? '',
    ELASTICSEARCH_URL: vars.ELASTICSEARCH_URL,
    STORAGE_MODE: vars.STORAGE_MODE,
    S3_ENDPOINT: vars.S3_ENDPOINT,
  };
}

describe('HALF-ENV operable overlay', () => {
  it('parseEnvAssignments skips comments and empty lines; last assignment wins', () => {
    const parsed = parseEnvAssignments('# x=1\n\nFOO=bar\n# BAZ=no\nMONGODB_URL=mongodb://x\nFOO=baz\n');
    expect(parsed).toEqual({ FOO: 'baz', MONGODB_URL: 'mongodb://x' });
    expect(parsed.BAZ).toBeUndefined();
  });

  it('.env.operable.example has http/s3/mongo and passes stackEnvIssues', () => {
    const text = readFileSync(path.join(repoRoot, '.env.operable.example'), 'utf8');
    const vars = parseEnvAssignments(text);
    expect(vars.INGEST_ES_MODE).toBe('http');
    expect(vars.RETRIEVE_ES_MODE).toBe('http');
    expect(vars.STORAGE_MODE).toBe('s3');
    expect(vars.S3_ENDPOINT).toMatch(/^http/);
    expect(vars.S3_ACCESS_KEY).toBeTruthy();
    expect(vars.S3_SECRET_KEY).toBeTruthy();
    expect(vars.MONGODB_URL).toMatch(/^mongodb:\/\//);
    expect(vars.AUTH_ENFORCE).toBe('false');
    expect(vars.INGEST_EMBED_MODE).toBe('mock');
    expect(vars.INGEST_SCAN_MODE).toBe('mock_clean');
    expect(stackEnvIssues(stackInput(vars))).toEqual([]);
  });

  it('append overlay over .env.example last-wins http/s3/mongo', () => {
    const base = readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
    const overlay = readFileSync(path.join(repoRoot, '.env.operable.example'), 'utf8');
    const vars = parseEnvAssignments(`${base}\n${overlay}`);
    expect(vars.INGEST_ES_MODE).toBe('http');
    expect(vars.RETRIEVE_ES_MODE).toBe('http');
    expect(vars.STORAGE_MODE).toBe('s3');
    expect(vars.MONGODB_URL).toMatch(/^mongodb:\/\//);
    expect(vars.AUTH_ENFORCE).toBe('false');
    expect(stackEnvIssues(stackInput(vars))).toEqual([]);
  });

  it('.env.example keeps mock/local/auth-off before overlay', () => {
    const vars = parseEnvAssignments(readFileSync(path.join(repoRoot, '.env.example'), 'utf8'));
    expect(vars.INGEST_ES_MODE).toBe('mock');
    expect(vars.RETRIEVE_ES_MODE).toBe('mock');
    expect(vars.STORAGE_MODE).toBe('local');
    expect(vars.AUTH_ENFORCE).toBe('false');
    expect(vars.INGEST_SCAN_MODE).toBe('mock_clean');
  });
});
