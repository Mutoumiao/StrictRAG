import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../env.js';

export type StoredObject = {
  bucket: string;
  key: string;
  byteSize: number;
  contentType: string;
  checksumSha256: string;
};

/**
 * P1 对象存储：local 目录模拟 S3 Head/Put（无密钥回显）。
 * STORAGE_MODE=s3 预留，未接 SDK 时回退 local。
 */
export class LocalObjectStorage {
  constructor(
    private readonly rootDir: string,
    private readonly bucket: string,
  ) {}

  get bucketName(): string {
    return this.bucket;
  }

  private objectPath(key: string): string {
    return path.join(this.rootDir, this.bucket, key);
  }

  async ensureReady(): Promise<void> {
    await mkdir(path.join(this.rootDir, this.bucket), { recursive: true });
  }

  /** 预签名等价：本地写路径 + 上传用 PUT 伪 URL */
  createUploadSlot(kbId: string, docId: string, contentType: string) {
    const key = `kb/${kbId}/docs/${docId}/${randomUUID()}`;
    return {
      bucket: this.bucket,
      key,
      contentType,
      /** 本地：api 代理 PUT /api/v1/internal/objects */
      uploadUrl: `/api/v1/internal/objects?key=${encodeURIComponent(key)}`,
      method: 'PUT' as const,
    };
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.ensureReady();
    const full = this.objectPath(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    const checksumSha256 = createHash('sha256').update(body).digest('hex');
    return {
      bucket: this.bucket,
      key,
      byteSize: body.byteLength,
      contentType,
      checksumSha256,
    };
  }

  async headObject(key: string): Promise<{ byteSize: number } | null> {
    try {
      const s = await stat(this.objectPath(key));
      if (!s.isFile()) return null;
      return { byteSize: s.size };
    } catch {
      return null;
    }
  }

  async getObjectBuffer(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.objectPath(key));
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const { unlink } = await import('node:fs/promises');
    try {
      await unlink(this.objectPath(key));
    } catch {
      // ignore missing
    }
  }
}

let storageSingleton: LocalObjectStorage | null = null;

export function getStorage(): LocalObjectStorage {
  if (!storageSingleton) {
    storageSingleton = new LocalObjectStorage(env.STORAGE_LOCAL_DIR, env.S3_BUCKET);
  }
  return storageSingleton;
}

export function effectiveMaxUploadBytes(): number {
  return Math.min(env.INGEST_MAX_FILE_BYTES, env.INGEST_MAX_FILE_BYTES_CEILING);
}
