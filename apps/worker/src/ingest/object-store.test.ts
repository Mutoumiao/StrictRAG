import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { readObjectText, storeConfigFromEnv } from './object-store.js';

describe('object-store local', () => {
  it('reads utf8 object', async () => {
    const dir = path.join(os.tmpdir(), `sr-obj-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const key = 'kb/x/docs/y/z.txt';
    const full = path.join(dir, 'strict-rag', key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, '对象正文', 'utf8');
    const text = await readObjectText(
      {
        mode: 'local',
        localDir: dir,
        bucket: 'strict-rag',
      },
      key,
    );
    expect(text).toBe('对象正文');
  });

  it('missing key returns empty', async () => {
    const text = await readObjectText(
      { mode: 'local', localDir: os.tmpdir(), bucket: 'strict-rag' },
      'no-such-key',
    );
    expect(text).toBe('');
  });

  it('storeConfigFromEnv maps s3', () => {
    expect(
      storeConfigFromEnv({
        STORAGE_MODE: 's3',
        STORAGE_LOCAL_DIR: '.data/objects',
        S3_BUCKET: 'strict-rag',
        S3_ENDPOINT: 'http://127.0.0.1:9000',
        S3_ACCESS_KEY: 'a',
        S3_SECRET_KEY: 'b',
      }).mode,
    ).toBe('s3');
  });
});
