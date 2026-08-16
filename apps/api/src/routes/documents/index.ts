import {
  BizCode,
  CompleteUploadBodySchema,
  CreateKbBodySchema,
  type CreateKbResponse,
  type CompleteUploadResponse,
  type DocumentApprovalActionResponse,
  type DocumentListItem,
  type DocumentScanEnqueueResponse,
  type PatchLifecycleResponse,
  type PutObjectResponse,
  type ReindexDocumentResponse,
  type UploadUrlResponse,
  PatchDocumentMetaBodySchema,
  PatchLifecycleBodySchema,
  ReindexDocumentBodySchema,
  UploadUrlBodySchema,
} from '@strict-rag/contracts';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';

import { requirePermission, requirePermissionWhenEnforced } from '../../auth/middleware.js';
import { canBecomeActive, canEnqueueScan, scanDeniedCode } from '../../gates/approval-scan.js';
import { checkUploadByteSize } from '../../gates/upload-size.js';
import { fail, ok } from '../../lib/response.js';
import { childLogger } from '../../logger.js';
import type { ApiVariables } from '../../middleware/request-id.js';
import {
  isMultiStrategyCatalog,
  resolveDocumentChunkStrategy,
} from '../../services/chunk-strategies.js';
import { documentRepo } from '../../services/documents.js';
import { enqueueIngest } from '../../services/queue.js';
import { effectiveMaxUploadBytes, getStorage } from '../../services/storage.js';
import { toDetail, toListItem } from './mappers.js';

export const documentRoutes = new Hono<{ Variables: ApiVariables }>();

/** POST /api/v1/knowledge-bases — AUTH_ENFORCE 时需 kb.create */
documentRoutes.post('/knowledge-bases', requirePermissionWhenEnforced('kb.create'), async (c) => {
  const parsed = CreateKbBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }
  const created = await documentRepo.createKb(parsed.data);
  const data: CreateKbResponse = created;
  return ok(c, data, 201);
});

/** GET /api/v1/knowledge-bases/:kbId/documents */
documentRoutes.get(
  '/knowledge-bases/:kbId/documents',
  requirePermissionWhenEnforced('doc.view'),
  async (c) => {
    const kbId = c.req.param('kbId');
    const rows = await documentRepo.listDocsByKb(kbId);
    const data: DocumentListItem[] = rows.map(toListItem);
    return ok(c, data);
  },
);

/** POST /api/v1/knowledge-bases/:kbId/documents/upload-url */
documentRoutes.post(
  '/knowledge-bases/:kbId/documents/upload-url',
  requirePermissionWhenEnforced('doc.upload'),
  async (c) => {
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

    const data: UploadUrlResponse = {
      docId,
      uploadUrl: slot.uploadUrl,
      method: slot.method,
      objectKey: slot.key,
      maxBytes: effectiveMaxUploadBytes(),
    };
    return ok(c, data, 201);
  },
);

/** PUT /api/v1/internal/objects — local storage 上传体 */
documentRoutes.put('/internal/objects', requirePermissionWhenEnforced('doc.upload'), async (c) => {
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
  const data: PutObjectResponse = {
    key: stored.key,
    byteSize: stored.byteSize,
    checksumSha256: stored.checksumSha256,
  };
  return ok(c, data);
});

/** POST .../complete — ADR-039 权威 size 闸 */
documentRoutes.post(
  '/knowledge-bases/:kbId/documents/:docId/complete',
  requirePermissionWhenEnforced('doc.upload'),
  async (c) => {
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
    const sizeGate = checkUploadByteSize(head.byteSize, max);
    if (!sizeGate.ok) {
      return fail(
        c,
        sizeGate.code,
        `object size ${head.byteSize} exceeds limit ${max}`,
        413,
        { maxBytes: max, actual: head.byteSize },
      );
    }

    // B12 / AA3：多策略 catalog 且文档尚无策略 → complete 必须显式传；已有策略可省略并保留（且须已实现）
    const multi = isMultiStrategyCatalog();
    const strategyGate = resolveDocumentChunkStrategy({
      existing: doc.chunkStrategy,
      requested: body.data.chunkStrategy,
      requireExplicit: multi && !doc.chunkStrategy?.trim(),
    });
    if (!strategyGate.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, strategyGate.message, 400);
    }

    await documentRepo.markCompletePending(docId, head.byteSize, {
      chunkStrategy: strategyGate.code,
    });

    childLogger({ requestId: c.get('requestId') }).info(
      {
        event: 'chunk_strategy_selected',
        docId,
        kbId,
        chunkStrategy: strategyGate.code,
        explicit: Boolean(body.data.chunkStrategy),
        retained: strategyGate.retained,
        changed: strategyGate.changed,
      },
      'chunk strategy selected on complete',
    );

    const data: CompleteUploadResponse = {
      docId,
      byteSize: head.byteSize,
      approvalStatus: 'pending',
      status: 'uploaded',
      chunkStrategy: strategyGate.code,
    };
    return ok(c, data);
  },
);

/**
 * POST /api/v1/documents/:docId/reindex — B12
 * 多策略时 body.chunkStrategy **必选**；无显式变更则保留旧策略。
 */
documentRoutes.post(
  '/documents/:docId/reindex',
  requirePermissionWhenEnforced('doc.reindex'),
  async (c) => {
    const docId = c.req.param('docId');
    const parsed = ReindexDocumentBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }

    const doc = await documentRepo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }

    // 多策略 catalog → reindex 强制显式传；最终 code 须 worker 已实现（见 resolve）
    const multi = isMultiStrategyCatalog();
    const strategyGate = resolveDocumentChunkStrategy({
      existing: doc.chunkStrategy,
      requested: parsed.data.chunkStrategy,
      requireExplicit: multi,
    });
    if (!strategyGate.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, strategyGate.message, 400);
    }

    if (strategyGate.changed) {
      await documentRepo.setChunkStrategy(docId, strategyGate.code);
    }

    const jobId =
      (await enqueueIngest({
        docId: doc.id,
        kbId: doc.kbId,
        tenantId: doc.tenantId,
        stage: 'chunk',
      })) ?? `local-${docId}`;

    childLogger({ requestId: c.get('requestId') }).info(
      {
        event: 'chunk_strategy_reindex',
        docId,
        chunkStrategy: strategyGate.code,
        strategyChanged: strategyGate.changed,
        retained: strategyGate.retained,
        jobId,
      },
      'reindex enqueued with chunk strategy',
    );

    const data: ReindexDocumentResponse = {
      docId,
      enqueued: true,
      jobId,
      stage: 'chunk',
      chunkStrategy: strategyGate.code,
      strategyChanged: strategyGate.changed,
    };
    // 与 scan 入队一致：200 信封（ok 不接受 202）
    return ok(c, data);
  },
);

/** POST /api/v1/documents/:docId/approve */
documentRoutes.post(
  '/documents/:docId/approve',
  requirePermissionWhenEnforced('approval.decide'),
  async (c) => {
    const docId = c.req.param('docId');
    const doc = await documentRepo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }
    if (doc.approvalStatus === 'approved') {
      const data: DocumentApprovalActionResponse = { docId, approvalStatus: 'approved' };
      return ok(c, data);
    }
    if (doc.approvalStatus !== 'pending') {
      return fail(
        c,
        BizCode.RULE_VIOLATION,
        `cannot approve when approvalStatus=${doc.approvalStatus}`,
      );
    }

    await documentRepo.approve(docId);
    const data: DocumentApprovalActionResponse = { docId, approvalStatus: 'approved' };
    return ok(c, data);
  },
);

/** POST /api/v1/documents/:docId/reject — 无 ticket 表时的最小驳回 */
documentRoutes.post(
  '/documents/:docId/reject',
  requirePermissionWhenEnforced('approval.decide'),
  async (c) => {
    const docId = c.req.param('docId');
    const doc = await documentRepo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }
    if (doc.approvalStatus === 'rejected') {
      const data: DocumentApprovalActionResponse = { docId, approvalStatus: 'rejected' };
      return ok(c, data);
    }
    if (doc.approvalStatus !== 'pending') {
      return fail(
        c,
        BizCode.RULE_VIOLATION,
        `cannot reject when approvalStatus=${doc.approvalStatus}`,
      );
    }
    await documentRepo.reject(docId);
    const data: DocumentApprovalActionResponse = { docId, approvalStatus: 'rejected' };
    return ok(c, data);
  },
);

/** POST /api/v1/documents/:docId/scan — ADR-048 闸 */
documentRoutes.post(
  '/documents/:docId/scan',
  requirePermissionWhenEnforced('doc.upload'),
  async (c) => {
    const docId = c.req.param('docId');
    const doc = await documentRepo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }
    if (!canEnqueueScan(doc.approvalStatus)) {
      return fail(c, scanDeniedCode(), 'document must be approved before scan', 403, {
        approvalStatus: doc.approvalStatus,
      });
    }

    const jobId = await enqueueIngest({
      docId: doc.id,
      kbId: doc.kbId,
      tenantId: doc.tenantId,
      stage: 'scan',
    });

    const data: DocumentScanEnqueueResponse = {
      docId,
      enqueued: true,
      jobId,
      stage: 'scan',
    };
    return ok(c, data);
  },
);

/** PATCH /api/v1/documents/:docId/lifecycle */
documentRoutes.patch(
  '/documents/:docId/lifecycle',
  requirePermissionWhenEnforced('doc.lifecycle'),
  async (c) => {
    const docId = c.req.param('docId');
    const parsed = PatchLifecycleBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }

    const doc = await documentRepo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }

    if (parsed.data.lifecycle === 'active' && !canBecomeActive(doc.status)) {
      return fail(c, BizCode.CONFLICT, 'only ready documents can become active', 409, {
        status: doc.status,
      });
    }

    await documentRepo.setLifecycle(docId, parsed.data.lifecycle);
    const data: PatchLifecycleResponse = {
      docId,
      lifecycle: parsed.data.lifecycle,
      status: doc.status,
    };
    return ok(c, data);
  },
);

/** PATCH /api/v1/documents/:docId — 只写 ownerDeptId / visibilityLevel；不改 lifecycle、不入队 */
documentRoutes.patch('/documents/:docId', requirePermission('doc.editor'), async (c) => {
  const docId = c.req.param('docId');
  const parsed = PatchDocumentMetaBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }

  const doc = await documentRepo.getDoc(docId);
  if (!doc) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }

  await documentRepo.patchMeta(docId, {
    ownerDeptId: parsed.data.ownerDeptId,
    visibilityLevel: parsed.data.visibilityLevel,
  });
  const updated = await documentRepo.getDoc(docId);
  if (!updated) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }
  return ok(c, toDetail(updated));
});

/** GET /api/v1/documents/:docId */
documentRoutes.get('/documents/:docId', requirePermissionWhenEnforced('doc.view'), async (c) => {
  const docId = c.req.param('docId');
  const doc = await documentRepo.getDoc(docId);
  if (!doc) {
    return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
  }
  return ok(c, toDetail(doc));
});
