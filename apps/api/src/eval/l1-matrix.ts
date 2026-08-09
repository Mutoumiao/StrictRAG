/**
 * L1 2×2 矩阵纯函数（评测 PRD §2）。
 * error 不进 A–D，由调用方累计 errorCount。
 */

export type GoldType = 'answerable' | 'unanswerable' | 'false_premise';
export type L1Outcome = 'answered' | 'abstained' | 'error';
export type L1Cell = 'A' | 'B' | 'C' | 'D';

export type L1Matrix = { A: number; B: number; C: number; D: number };

export function emptyMatrix(): L1Matrix {
  return { A: 0, B: 0, C: 0, D: 0 };
}

/** type×outcome → 格；error → null（不计格） */
export function cellFor(type: GoldType, outcome: L1Outcome): L1Cell | null {
  if (outcome === 'error') return null;
  if (type === 'answerable') {
    return outcome === 'answered' ? 'A' : 'B';
  }
  // unanswerable | false_premise
  return outcome === 'answered' ? 'C' : 'D';
}

/**
 * 就地累加一格。返回 error 增量（0 或 1）。
 * ponytail: mutate matrix in place; clone if you need snapshots
 */
export function accumulate(
  matrix: L1Matrix,
  type: GoldType,
  outcome: L1Outcome,
): number {
  const cell = cellFor(type, outcome);
  if (!cell) return 1;
  matrix[cell] += 1;
  return 0;
}

/** 覆盖率 = A/(A+B)；分母 0 → null */
export function coverage(matrix: L1Matrix): number | null {
  const den = matrix.A + matrix.B;
  if (den === 0) return null;
  return matrix.A / den;
}
