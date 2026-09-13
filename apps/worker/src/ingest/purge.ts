import type { IngestStage } from '../queues.js';

export type PurgeDoc = {
  id: string;
  objectKey: string | null;
};

export type PurgeDeps = {
  deleteObject: (objectKey: string | null) => Promise<void>;
  dropSparse: (docId: string) => void;
  deleteMongoBodies: (docId: string) => Promise<void>;
  patchDoc: (patch: {
    lifecycle: 'archived';
    objectKey: null;
    embedReady: 0;
    esReady: 0;
  }) => Promise<void>;
};

/** purge 不是入库正向阶段，不要求已审批。 */
export function pipelineRequiresApproval(stage: IngestStage): boolean {
  return stage !== 'purge';
}

/** 清对象 / mock 稀疏 / 可选 Mongo；PG 行保持 archived。二次调用依赖适配器幂等。 */
export async function runDocumentPurge(doc: PurgeDoc, deps: PurgeDeps): Promise<void> {
  await deps.deleteObject(doc.objectKey);
  deps.dropSparse(doc.id);
  await deps.deleteMongoBodies(doc.id);
  await deps.patchDoc({
    lifecycle: 'archived',
    objectKey: null,
    embedReady: 0,
    esReady: 0,
  });
}
