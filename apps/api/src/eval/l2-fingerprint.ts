import { createHash } from 'node:crypto';

// ponytail: SHA-256 稳定即可；不要把窗/问句/evidence 算进去
export function l2RewriteFingerprint(prompt: string, modelId: string): string {
  return createHash('sha256').update(`${prompt}\0${modelId}`).digest('hex');
}
