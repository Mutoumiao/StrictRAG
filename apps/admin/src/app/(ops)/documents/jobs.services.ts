'use client';

import type { IngestJobListItem } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { listIngestJobs } from './api';

export async function loadIngestJobs(docId: string) {
  try {
    const jobs = await listIngestJobs(docId);
    return { ok: true as const, jobs };
  } catch (err) {
    return { ok: false as const, message: mapBizError(err), jobs: [] as IngestJobListItem[] };
  }
}
