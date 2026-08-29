import type { EvalCaseExecute, EvalCaseExecuteResult } from './run-l1-batch.js';

export type EvalHttpExecuteOpts = {
  baseUrl: string;
  token: string;
  kbId: string;
  tenantId: string;
  userId: string;
  fetchImpl?: typeof fetch;
};

type ExecuteAskJson = {
  ok?: boolean;
  data?: { status?: string; reason?: string };
  error?: { message?: string };
};

/**
 * worker → api POST /api/v1/internal/eval/execute-ask（skipTrace 在 api 侧）。
 */
export function createEvalHttpExecute(opts: EvalHttpExecuteOpts): EvalCaseExecute {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/$/, '');

  return async ({ question }): Promise<EvalCaseExecuteResult> => {
    if (!opts.token) {
      return { outcome: 'error', errorMessage: 'EVAL_INTERNAL_TOKEN is empty' };
    }
    const res = await fetchImpl(`${base}/api/v1/internal/eval/execute-ask`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-eval-internal-token': opts.token,
      },
      body: JSON.stringify({
        kbId: opts.kbId,
        tenantId: opts.tenantId,
        userId: opts.userId,
        question,
      }),
    });
    let payload: ExecuteAskJson = {};
    try {
      payload = (await res.json()) as ExecuteAskJson;
    } catch {
      return { outcome: 'error', errorMessage: `execute-ask HTTP ${res.status}` };
    }
    if (!res.ok || payload.ok === false) {
      return {
        outcome: 'error',
        errorMessage: payload.error?.message ?? `execute-ask HTTP ${res.status}`,
      };
    }
    const status = payload.data?.status;
    if (status === 'answered' || status === 'abstained') {
      return { outcome: status, reason: payload.data?.reason };
    }
    return { outcome: 'error', errorMessage: `unexpected ask status: ${String(status)}` };
  };
}
