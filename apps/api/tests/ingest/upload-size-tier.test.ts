/**
 * 目标：上传生效上限须按族取档 —— MD/TXT 更严（默认 10 MiB），其余仍 50 MiB；族级可关。
 * 需求：功能表 §5.2 / §6「MD/TXT 可更严」· prds/09-security §7
 * 被测：effectiveMaxUploadBytes（含 env 默认与 0 = 关闭族级）
 * 简介：族级档只对文本族生效；关掉即回落通用；上限仍受天花板 min。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const GENERAL = 52_428_800; // 50 MiB
const TEXT = 10_485_760; // 10 MiB

/** env 在模块加载时 parse，故每个用例前重置模块再动态 import */
async function loadWith(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return await import('../../src/services/storage.js');
}

const KEYS = [
  'INGEST_MAX_FILE_BYTES',
  'INGEST_MAX_FILE_BYTES_CEILING',
  'INGEST_MAX_TEXT_FILE_BYTES',
] as const;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.resetModules();
});

describe('effectiveMaxUploadBytes 族级档', () => {
  it('默认：文本族 10 MiB，其余 50 MiB，未给类型按通用', async () => {
    const { effectiveMaxUploadBytes } = await loadWith({
      INGEST_MAX_FILE_BYTES: undefined,
      INGEST_MAX_FILE_BYTES_CEILING: undefined,
      INGEST_MAX_TEXT_FILE_BYTES: undefined,
    });
    expect(effectiveMaxUploadBytes('text/markdown')).toBe(TEXT);
    expect(effectiveMaxUploadBytes('text/plain')).toBe(TEXT);
    expect(effectiveMaxUploadBytes('text/plain; charset=utf-8')).toBe(TEXT);
    expect(effectiveMaxUploadBytes('application/pdf')).toBe(GENERAL);
    expect(effectiveMaxUploadBytes()).toBe(GENERAL);
  });

  it('族级设 0 = 关闭族级档，文本族回落通用', async () => {
    const { effectiveMaxUploadBytes } = await loadWith({ INGEST_MAX_TEXT_FILE_BYTES: '0' });
    expect(effectiveMaxUploadBytes('text/markdown')).toBe(GENERAL);
  });

  it('族级可调更严；仍受通用与天花板 min', async () => {
    const tighter = await loadWith({ INGEST_MAX_TEXT_FILE_BYTES: '1024' });
    expect(tighter.effectiveMaxUploadBytes('text/plain')).toBe(1024);

    const raised = await loadWith({
      INGEST_MAX_FILE_BYTES: '20971520',
      INGEST_MAX_TEXT_FILE_BYTES: '10485760',
    });
    expect(raised.effectiveMaxUploadBytes('text/plain')).toBe(TEXT);
    expect(raised.effectiveMaxUploadBytes('application/pdf')).toBe(20_971_520);
  });
});
