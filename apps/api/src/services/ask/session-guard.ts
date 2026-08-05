import type { SessionsRepo } from '../sessions.js';
import { sessionsRepo } from '../sessions.js';

export type ResolveOwnedSession = (input: {
  sessionId: string;
  kbId: string;
  userId: string;
}) => Promise<boolean>;

/** 默认查 PG；测例可注入 */
export function createResolveOwnedSession(repo: SessionsRepo = sessionsRepo): ResolveOwnedSession {
  return async (input) => {
    const row = await repo.getOwned(input);
    return Boolean(row);
  };
}

export const resolveOwnedSessionDefault = createResolveOwnedSession();
