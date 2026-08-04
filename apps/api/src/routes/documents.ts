import { BizCode } from '@strict-rag/contracts';
import {
  CompleteUploadBodySchema,
  CreateKbBodySchema,
  PatchLifecycleBodySchema,
  UploadUrlBodySchema,
} from '@strict-rag/contracts';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';

import { fail, ok } from '../lib/response.js';
import type { ApiVariables } from '../middleware/request-id.js';
import { documentRepo } from '../services/documents.js';
import { enqueueIngest } from '../services/queue.js';
import { effectiveMaxUploadBytes, getStorage } from '../services/storage.js';

export const documentRoutes = new Hono<{ Variables: ApiVariables }>();

/** POST /api/v1/knowledge-bases — P1 demo create KB (no auth) */
documentRoutes.post('/knowledge-bases', async (c) => {
  const parsed = CreateKbBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }
  const created = await documentRepo.createKb(parsed.data);
  return ok(c, created, 201);
});

/** GET /api/v1/knowledge-bases/:kbId/documents */
documentRoutes.get('/knowledge-bases/:kbId/documents', async (c) => {
  const kbId = c.req.param('kbId');
  const rows = await documentRepo.listDocsByKb(kbId);
  return ok(
    c,
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      approvalStatus: r.approvalStatus,
      lifecycle: r.lifecycle,
      byteSize: r.byteSize,
      indexVersion: r.indexVersion,
      errorCode: r.errorCode,
      embedReady: r.embedReady === 1,
      esReady: r.esReady === 1,
    })),
  );
});

/** POST /api/v1/knowledge-bases/:kbId/documents/upload-url */
documentRoutes.post('/knowledge-bases/:kbId/documents/upload-url', async (c) => {
  const kbId = c.req.param('kbId');
  const parsed = UploadUrlBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }

  const kb = await documentRepo.getKb(kbId);
  if (!kb) {
    return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
  }

  const storage = getStorage();
  const docId = uuidv7();
  const slot = storage.createUploadSlot(kbId, docId, parsed.data.contentType);
  await documentRepo.insertUploadedDoc({
    id: docId,
    tenantId: kb.tenantId,
    kbId,
    title: parsed.data.title,
    objectBucket: slot.bucket,
    objectKey: slot.key,
    contentType: parsed.data.contentType,
  });

  return ok(
    c,
    {
      docId,
      uploadUrl: slot.uploadUrl,
      method: slot.method,
      objectKey: slot.key,
      maxBytes: effectiveMaxUploadBytes(),
    },
    201,
  );
});

/** PUT /api/v1/internal/objects — local storage 上传体 */
documentRoutes.put('/internal/objects', async (c) => {
  const key = c.req.query('key');
  if (!key) {
    return fail(c, BizCode.VALIDATION_ERROR, 'key required');
  }
  const contentType = c.req.header('content-type') ?? 'application/octet-stream';
  const ab = await c.req.arrayBuffer();
  const buf = Buffer.from(ab);
  const max = effectiveMaxUploadBytes();
  if (buf.byteLength > max) {
    return fail(
      c,
      BizCode.PAYLOAD_TOO_LARGE,
      `upload exceeds limit ${max} bytes`,
      413,
      { maxBytes: max, actual: buf.byteLength },
    );
  }
  const stored = await getStorage().putObject(key, buf, contentType);
  return ok(c, { key: stored.key, byteSize: stored.byteSize, checksumSha256: stored.checksumSha256 });
});

/** POST .../complete — ADR-039 权威 size 闸 */
documentRoutes.post('/knowledge-bases/:kbId/documents/:docId/complete', async (c) => {
  const { kbId, docId } = c.req.param();
  const body = CompleteUploadBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, body.error.flatten());
  }

  const doc = await documentRepo.getDoc(docId);
  if (!doc || doc.kbId !== kbId) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }
  if (!doc.objectKey) {
    return fail(c, BizCode.RULE_VIOLATION, 'document has no object key');
  }

  const head = await getStorage().headObject(doc.objectKey);
  if (!head) {
    return fail(c, BizCode.NOT_FOUND, 'object not found in storage', 404);
  }

  const max = effectiveMaxUploadBytes();
  if (head.byteSize > max) {
    return fail(
      c,
      BizCode.PAYLOAD_TOO_LARGE,
      `object size ${head.byteSize} exceeds limit ${max}`,
      413,
      { maxBytes: max, actual: head.byteSize },
    );
  }

  await documentRepo.markCompletePending(docId, head.byteSize);

  return ok(c, {
    docId,
    byteSize: head.byteSize,
    approvalStatus: 'pending',
    status: 'uploaded',
  });
});

/** POST /api/v1/documents/:docId/approve */
documentRoutes.post('/documents/:docId/approve', async (c) => {
  const docId = c.req.param('docId');
  const doc = await documentRepo.getDoc(docId);
  if (!doc) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }
  if (doc.approvalStatus === 'approved') {
    return ok(c, { docId, approvalStatus: 'approved' });
  }
  if (doc.approvalStatus !== 'pending') {
    return fail(
      c,
      BizCode.RULE_VIOLATION,
      `cannot approve when approvalStatus=${doc.approvalStatus}`,
    );
  }

  await documentRepo.approve(docId);
  return ok(c, { docId, approvalStatus: 'approved' });
});

/** POST /api/v1/documents/:docId/scan — ADR-048 闸 */
documentRoutes.post('/documents/:docId/scan', async (c) => {
  const docId = c.req.param('docId');
  const doc = await documentRepo.getDoc(docId);
  if (!doc) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }
  if (doc.approvalStatus !== 'approved') {
    return fail(c, BizCode.FORBIDDEN, 'document must be approved before scan', 403, {
      approvalStatus: doc.approvalStatus,
    });
  }

  const jobId = await enqueueIngest({
    docId: doc.id,
    kbId: doc.kbId,
    tenantId: doc.tenantId,
    stage: 'scan',
  });

  return ok(c, { docId, enqueued: true, jobId, stage: 'scan' });
});

/** PATCH /api/v1/documents/:docId/lifecycle */
documentRoutes.patch('/documents/:docId/lifecycle', async (c) => {
  const docId = c.req.param('docId');
  const parsed = PatchLifecycleBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }

  const doc = await documentRepo.getDoc(docId);
  if (!doc) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }

  if (parsed.data.lifecycle === 'active' && doc.status !== 'ready') {
    return fail(c, BizCode.CONFLICT, 'only ready documents can become active', 409, {
      status: doc.status,
    });
  }

  await documentRepo.setLifecycle(docId, parsed.data.lifecycle);
  return ok(c, { docId, lifecycle: parsed.data.lifecycle, status: doc.status });
});

/** GET /api/v1/documents/:docId */
documentRoutes.get('/documents/:docId', async (c) => {
  const docId = c.req.param('docId');
  const doc = await documentRepo.getDoc(docId);
  if (!doc) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }
  return ok(c, doc);
});
