import { createHash } from 'node:crypto';

import { BizCode, type CompleteUploadResponse } from '@strict-rag/contracts';

import { checkUploadMedia } from '../gates/upload-media.js';
import { checkUploadByteSize } from '../gates/upload-size.js';
import { childLogger } from '../logger.js';
import { recordIngestComplete, type RateLimitResult } from '../obs/index.js';
import { getForUpload, paramsSnapshotFor } from './chunk-strategy-catalog.js';
import { resolveBindChunkStrategy } from './chunk-strategies.js';
import { documentRepo } from './documents.js';
import {
  isSensitiveCompleteBlocked,
  parseDataClassFromConfig,
  parseDeptAclEnforceFromConfig,
  resolveDeptAclEnforce,
} from './kb-settings.js';
import { effectiveMaxUploadBytes, getStorage } from './storage.js';

export type FinalizePendingFields = {
  chunkStrategy?: string;
  ownerDeptId?: string | null;
  visibilityLevel?: 10 | 20 | 30 | 40;
  aclPrincipals?: string[] | null;
  checksumSha256?: string;
};

export type FinalizePendingFail = {
  ok: false;
  code: (typeof BizCode)[keyof typeof BizCode];
  message: string;
  httpStatus: 400 | 404 | 413 | 415 | 429;
  details?: unknown;
};

export type FinalizePendingOk = {
  ok: true;
  data: CompleteUploadResponse;
};

export type WriteGateOk = {
  ok: true;
  strategyCode: string;
  strategyParams: Record<string, unknown>;
};

/** write 落对象前：策略 / 敏感 ACL / ingest 配额。失败不得 put/insert。 */
export async function evaluateWriteIngestGates(input: {
  kbId: string;
  tenantId: string;
  contentType: string;
  fileName?: string | null;
  byteSize: number;
  fields: FinalizePendingFields;
  requestId: string;
  checkIngestLimit: (tenantId: string, kbId: string) => RateLimitResult;
}): Promise<FinalizePendingFail | WriteGateOk> {
  const { kbId, tenantId, contentType, fileName, byteSize, fields, requestId, checkIngestLimit } =
    input;
  const mediaGate = checkUploadMedia({ contentType, fileName });
  if (!mediaGate.ok) {
    return {
      ok: false,
      code: mediaGate.code,
      message: 'unsupported media type',
      httpStatus: 415,
    };
  }
  const max = effectiveMaxUploadBytes();
  const sizeGate = checkUploadByteSize(byteSize, max);
  if (!sizeGate.ok) {
    return {
      ok: false,
      code: sizeGate.code,
      message: `object size ${byteSize} exceeds limit ${max}`,
      httpStatus: 413,
      details: { maxBytes: max, actual: byteSize },
    };
  }

  const forUpload = await getForUpload(kbId, contentType);
  const strategyGate = resolveBindChunkStrategy({
    availableCodes: forUpload.available.map((a) => a.code),
    requested: fields.chunkStrategy,
  });
  if (!strategyGate.ok) {
    return {
      ok: false,
      code: BizCode.VALIDATION_ERROR,
      message: strategyGate.message,
      httpStatus: 400,
    };
  }
  const strategyParams = await paramsSnapshotFor(kbId, strategyGate.code);

  const kb = await documentRepo.getKb(kbId);
  if (!kb) {
    return {
      ok: false,
      code: BizCode.NOT_FOUND,
      message: 'knowledge base not found',
      httpStatus: 404,
    };
  }
  const dataClass = parseDataClassFromConfig(kb.configJson ?? null);
  const enforce = resolveDeptAclEnforce(parseDeptAclEnforceFromConfig(kb.configJson ?? null));
  const ownerDeptId = fields.ownerDeptId === undefined ? null : fields.ownerDeptId;
  const aclPrincipals = fields.aclPrincipals === undefined ? null : fields.aclPrincipals;
  if (
    isSensitiveCompleteBlocked({
      dataClass,
      ownerDeptId,
      deptAclEnforce: enforce,
      aclPrincipals,
    })
  ) {
    return {
      ok: false,
      code: BizCode.RULE_VIOLATION,
      message: 'sensitive knowledge base cannot complete until ACL is ready',
      httpStatus: 400,
    };
  }

  const ingestRl = checkIngestLimit(tenantId, kbId);
  if (!ingestRl.ok) {
    recordIngestComplete({ result: 'rate_limited' });
    childLogger({ requestId }).warn(
      { retryAfterSec: ingestRl.retryAfterSec, plane: 'ingest', kbId },
      'ingest rate limited',
    );
    return {
      ok: false,
      code: BizCode.RATE_LIMITED,
      message: 'ingest rate limit exceeded',
      httpStatus: 429,
      details: { retryAfterSec: ingestRl.retryAfterSec, plane: 'ingest' },
    };
  }

  return { ok: true, strategyCode: strategyGate.code, strategyParams };
}

export async function finalizePendingIngest(input: {
  kbId: string;
  docId: string;
  fields: FinalizePendingFields;
  requestId: string;
  checkIngestLimit: (tenantId: string, kbId: string) => RateLimitResult;
  /** 提交人（认不出 actor 时省略，禁止编造） */
  actorUserId?: string;
  logEvent?: string;
}): Promise<FinalizePendingOk | FinalizePendingFail> {
  const { kbId, docId, fields, requestId, checkIngestLimit, actorUserId } = input;
  const doc = await documentRepo.getDoc(docId);
  if (!doc || doc.kbId !== kbId) {
    return { ok: false, code: BizCode.NOT_FOUND, message: 'document not found', httpStatus: 404 };
  }
  if (!doc.objectKey) {
    return {
      ok: false,
      code: BizCode.RULE_VIOLATION,
      message: 'document has no object key',
      httpStatus: 400,
    };
  }

  const head = await getStorage().headObject(doc.objectKey);
  if (!head) {
    return {
      ok: false,
      code: BizCode.NOT_FOUND,
      message: 'object not found in storage',
      httpStatus: 404,
    };
  }

  const mediaGate = checkUploadMedia({ contentType: doc.contentType, fileName: doc.title });
  if (!mediaGate.ok) {
    return {
      ok: false,
      code: mediaGate.code,
      message: 'unsupported media type',
      httpStatus: 415,
    };
  }

  const max = effectiveMaxUploadBytes();
  const sizeGate = checkUploadByteSize(head.byteSize, max);
  if (!sizeGate.ok) {
    return {
      ok: false,
      code: sizeGate.code,
      message: `object size ${head.byteSize} exceeds limit ${max}`,
      httpStatus: 413,
      details: { maxBytes: max, actual: head.byteSize },
    };
  }

  const bodyBuf = await getStorage().getObjectBuffer(doc.objectKey);
  if (!bodyBuf) {
    return {
      ok: false,
      code: BizCode.NOT_FOUND,
      message: 'object not found in storage',
      httpStatus: 404,
    };
  }
  const checksumSha256 = createHash('sha256').update(bodyBuf).digest('hex');
  if (
    fields.checksumSha256 &&
    fields.checksumSha256.toLowerCase() !== checksumSha256
  ) {
    return {
      ok: false,
      code: BizCode.VALIDATION_ERROR,
      message: 'checksum mismatch',
      httpStatus: 400,
    };
  }

  const forUpload = await getForUpload(kbId, doc.contentType ?? 'text/plain');
  const strategyGate = resolveBindChunkStrategy({
    availableCodes: forUpload.available.map((a) => a.code),
    requested: fields.chunkStrategy,
  });
  if (!strategyGate.ok) {
    return {
      ok: false,
      code: BizCode.VALIDATION_ERROR,
      message: strategyGate.message,
      httpStatus: 400,
    };
  }
  const strategyParams = await paramsSnapshotFor(kbId, strategyGate.code);

  let ownerDeptId = doc.ownerDeptId;
  let aclPrincipals = doc.aclPrincipals ?? null;
  if (
    fields.ownerDeptId !== undefined ||
    fields.visibilityLevel !== undefined ||
    fields.aclPrincipals !== undefined
  ) {
    await documentRepo.patchMeta(docId, {
      ownerDeptId: fields.ownerDeptId,
      visibilityLevel: fields.visibilityLevel,
      aclPrincipals: fields.aclPrincipals,
    });
    const latest = await documentRepo.getDoc(docId);
    if (!latest) {
      return { ok: false, code: BizCode.NOT_FOUND, message: 'document not found', httpStatus: 404 };
    }
    ownerDeptId = latest.ownerDeptId;
    aclPrincipals = latest.aclPrincipals ?? null;
  }

  const kb = await documentRepo.getKb(kbId);
  if (!kb) {
    return {
      ok: false,
      code: BizCode.NOT_FOUND,
      message: 'knowledge base not found',
      httpStatus: 404,
    };
  }
  const dataClass = parseDataClassFromConfig(kb.configJson ?? null);
  const enforce = resolveDeptAclEnforce(parseDeptAclEnforceFromConfig(kb.configJson ?? null));
  if (
    isSensitiveCompleteBlocked({
      dataClass,
      ownerDeptId,
      deptAclEnforce: enforce,
      aclPrincipals,
    })
  ) {
    return {
      ok: false,
      code: BizCode.RULE_VIOLATION,
      message: 'sensitive knowledge base cannot complete until ACL is ready',
      httpStatus: 400,
    };
  }

  const ingestRl = checkIngestLimit(doc.tenantId, kbId);
  if (!ingestRl.ok) {
    recordIngestComplete({ result: 'rate_limited' });
    childLogger({ requestId }).warn(
      { retryAfterSec: ingestRl.retryAfterSec, plane: 'ingest', kbId, docId },
      'ingest rate limited',
    );
    return {
      ok: false,
      code: BizCode.RATE_LIMITED,
      message: 'ingest rate limit exceeded',
      httpStatus: 429,
      details: { retryAfterSec: ingestRl.retryAfterSec, plane: 'ingest' },
    };
  }

  await documentRepo.markCompletePending(docId, head.byteSize, {
    chunkStrategy: strategyGate.code,
    chunkStrategyParams: strategyParams,
    checksumSha256,
    ...(actorUserId !== undefined ? { uploadedBy: actorUserId } : {}),
  });
  recordIngestComplete({ result: 'ok' });

  childLogger({ requestId }).info(
    {
      event: input.logEvent ?? 'chunk_strategy_selected',
      docId,
      kbId,
      chunkStrategy: strategyGate.code,
      explicit: Boolean(fields.chunkStrategy),
      available: forUpload.available.map((a) => a.code),
    },
    'chunk strategy selected on complete',
  );

  return {
    ok: true,
    data: {
      docId,
      byteSize: head.byteSize,
      approvalStatus: 'pending',
      status: 'uploaded',
      chunkStrategy: strategyGate.code,
    },
  };
}
