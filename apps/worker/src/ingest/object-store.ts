import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

export type ObjectStoreConfig = {
  mode: 'local' | 's3';
  localDir: string;
  bucket: string;
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
};

function localPath(cfg: ObjectStoreConfig, key: string): string {
  return path.join(cfg.localDir, cfg.bucket, key);
}

function s3Client(cfg: ObjectStoreConfig): S3Client {
  return new S3Client({
    region: 'us-east-1',
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.accessKey || 'strict_rag',
      secretAccessKey: cfg.secretKey || 'strict_rag_secret',
    },
  });
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
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

export async function readObjectText(cfg: ObjectStoreConfig, objectKey: string | null): Promise<string> {
  if (!objectKey) return '';
  if (cfg.mode !== 's3') {
    try {
      return await readFile(localPath(cfg, objectKey), 'utf8');
    } catch {
      return '';
    }
  }
  const client = s3Client(cfg);
  try {
    const out = await client.send(
      new GetObjectCommand({ Bucket: cfg.bucket, Key: objectKey }),
    );
    const buf = await bodyToBuffer(out.Body);
    return buf.toString('utf8');
  } catch {
    return '';
  } finally {
    client.destroy();
  }
}

export async function deleteObject(cfg: ObjectStoreConfig, objectKey: string | null): Promise<void> {
  if (!objectKey) return;
  if (cfg.mode !== 's3') {
    try {
      await unlink(localPath(cfg, objectKey));
    } catch {
      /* ignore */
    }
    return;
  }
  const client = s3Client(cfg);
  try {
    await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: objectKey }));
  } catch {
    /* ignore */
  } finally {
    client.destroy();
  }
}

export function storeConfigFromEnv(env: {
  STORAGE_MODE: 'local' | 's3';
  STORAGE_LOCAL_DIR: string;
  S3_BUCKET: string;
  S3_ENDPOINT: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
}): ObjectStoreConfig {
  return {
    mode: env.STORAGE_MODE,
    localDir: env.STORAGE_LOCAL_DIR,
    bucket: env.S3_BUCKET,
    endpoint: env.S3_ENDPOINT,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
  };
}
