import { EvalJobDataSchema, type EvalJobData } from '@strict-rag/contracts';

import { env } from '../env.js';
import { logger } from '../logger.js';
import { createEvalHttpExecute } from './execute-ask-http.js';
import { evalPersist, type EvalPersist } from './persist.js';
import { runL1Batch, type EvalCaseExecute } from './run-l1-batch.js';

export type EvalConsumerDeps = {
  persist?: EvalPersist;
  executeFor?: (job: EvalJobData) => EvalCaseExecute;
};

export async function handleEvalJob(
  raw: unknown,
  deps: EvalConsumerDeps = {},
): Promise<{ ok: true; caseCount: number } | { ok: false; error: string }> {
  const parsed = EvalJobDataSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'invalid eval job payload' };
  }
  const job = parsed.data;
  const persist = deps.persist ?? evalPersist;
  await persist.markRunning(job.runId);

  const cases = await persist.loadGold(job.kbId);
  if (cases.length === 0) {
    const msg = 'no gold questions';
    await persist.markFailed(job.runId, msg);
    return { ok: false, error: msg };
  }

  const execute =
    deps.executeFor?.(job) ??
    createEvalHttpExecute({
      baseUrl: env.EVAL_ASK_BASE_URL,
      token: env.EVAL_INTERNAL_TOKEN,
      kbId: job.kbId,
      tenantId: job.tenantId,
      userId: job.userId,
    });

  try {
    const report = await runL1Batch({
      kbId: job.kbId,
      cases,
      retrieveMode: job.retrieveMode,
      execute,
      maxCases: job.maxCases,
    });
    await persist.saveReport(job.runId, report);
    logger.info(
      { runId: job.runId, kbId: job.kbId, caseCount: report.caseCount, coverage: report.coverage },
      'eval run completed',
    );
    return { ok: true, caseCount: report.caseCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await persist.markFailed(job.runId, message);
    logger.error({ err, runId: job.runId }, 'eval run failed');
    return { ok: false, error: message };
  }
}
