import { ingestJobs } from '@strict-rag/db';
import { desc, eq } from 'drizzle-orm';

import { getDb } from './db.js';

export function toIngestJobListItem(row: {
  id: string;
  docId: string;
  jobName: string;
  status: string;
  errorMessage: string | null;
  indexVersion: number | null;
  createdAt: string | null;
}) {
  return {
    id: row.id,
    docId: row.docId,
    jobName: row.jobName,
    status: row.status,
    errorMessage: row.errorMessage,
    indexVersion: row.indexVersion,
    createdAt: row.createdAt,
  };
}

export const ingestJobsRepo = {
  async listByDocId(docId: string) {
    const rows = await getDb()
      .select({
        id: ingestJobs.id,
        docId: ingestJobs.docId,
        jobName: ingestJobs.jobName,
        status: ingestJobs.status,
        errorMessage: ingestJobs.errorMessage,
        indexVersion: ingestJobs.indexVersion,
        createdAt: ingestJobs.createdAt,
      })
      .from(ingestJobs)
      .where(eq(ingestJobs.docId, docId))
      .orderBy(desc(ingestJobs.createdAt))
      .limit(20);
    return rows.map(toIngestJobListItem);
  },
};
