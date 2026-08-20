import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
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

export type ObjectStorage = {
  readonly bucketName: string;
  ensureReady(): Promise<void>;
  createUploadSlot(
    kbId: string,
    docId: string,
    contentType: string,
  ): {
    bucket: string;
    key: string;
    contentType: string;
    uploadUrl: string;
    method: 'PUT';
  };
  putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  headObject(key: string): Promise<{ byteSize: number } | null>;
  getObjectBuffer(key: string): Promise<Buffer | null>;
  deleteObject(key: string): Promise<void>;
};

function uploadSlot(bucket: string, kbId: string, docId: string, contentType: string) {
  const key = `kb/${kbId}/docs/${docId}/${randomUUID()}`;
  return {
    bucket,
    key,
    contentType,
    /** 本地：api 代理 PUT /api/v1/internal/objects（s3 同样走代理，前端不改） */
    uploadUrl: `/api/v1/internal/objects?key=${encodeURIComponent(key)}`,
    method: 'PUT' as const,
  };
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  const withTransform = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof withTransform.transformToByteArray === 'function') {
    return Buffer.from(await withTransform.transformToByteArray());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * P1 对象存储：local 目录模拟 S3 Head/Put（无密钥回显）。
 */
export class LocalObjectStorage implements ObjectStorage {
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
    return uploadSlot(this.bucket, kbId, docId, contentType);
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

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(
    endpoint: string,
    accessKey: string,
    secretKey: string,
    private readonly bucket: string,
  ) {
    this.client = new S3Client({
      region: 'us-east-1',
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: accessKey || 'strict_rag',
        secretAccessKey: secretKey || 'strict_rag_secret',
      },
    });
  }

  get bucketName(): string {
    return this.bucket;
  }

  async ensureReady(): Promise<void> {
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    } catch (err) {
      const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
      if (name === 'BucketAlreadyOwnedByYou' || name === 'BucketAlreadyExists') return;
      throw err;
    }
  }

  createUploadSlot(kbId: string, docId: string, contentType: string) {
    return uploadSlot(this.bucket, kbId, docId, contentType);
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    await this.ensureReady();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
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
      const out = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { byteSize: out.ContentLength ?? 0 };
    } catch {
      return null;
    }
  }

  async getObjectBuffer(key: string): Promise<Buffer | null> {
    try {
      const out = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return await streamToBuffer(out.Body);
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      // ignore missing
    }
  }
}

let storageSingleton: ObjectStorage | null = null;

export function getStorage(): ObjectStorage {
  if (!storageSingleton) {
    if (env.STORAGE_MODE === 's3') {
      storageSingleton = new S3ObjectStorage(
        env.S3_ENDPOINT,
        env.S3_ACCESS_KEY,
        env.S3_SECRET_KEY,
        env.S3_BUCKET,
      );
    } else {
      storageSingleton = new LocalObjectStorage(env.STORAGE_LOCAL_DIR, env.S3_BUCKET);
    }
  }
  return storageSingleton;
}

export function effectiveMaxUploadBytes(): number {
  return Math.min(env.INGEST_MAX_FILE_BYTES, env.INGEST_MAX_FILE_BYTES_CEILING);
}
