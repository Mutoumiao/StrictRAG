export type EffectiveWindowLike = {
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

function bound(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/**
 * 默认检索生效窗口：from <= now < to。
 * 缺界 = 不限。比较对象是 yyyy-MM-dd HH:mm:ss 本地串。
 */
export function isWithinEffectiveWindow(doc: EffectiveWindowLike, now: string): boolean {
  const from = bound(doc.effectiveFrom);
  const to = bound(doc.effectiveTo);
  if (from && from > now) return false;
  if (to && to <= now) return false;
  return true;
}

/** 两界都有时 from 不得晚于 to。缺一界视为有序。 */
export function isEffectiveWindowOrdered(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  const a = bound(from);
  const b = bound(to);
  if (!a || !b) return true;
  return a <= b;
}
