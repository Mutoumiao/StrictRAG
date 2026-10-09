/**
 * 签字包「加载」校验（`prds/08-quality/02-evaluation-and-gates.md` §6.0 加载行 · ADR-046 决策 #4 · ADR-062）。
 *
 * 冻结要求逐字：「运行时质量参数 **仅**来自已签字包；不一致 → **拒绝加载**」。落地形态 = **包为权威、
 * env 为承载且必须与包相等**：包内冻结的 τ 与运行时的 `TAU_CLAIM` 不等 → 该包**不被加载**（读面不把它
 * 呈现为「该 KB 的签字包」）；包内**未记录** τ → 同样不加载（无依据的绑定声明比不呈现更坏）。
 *
 * **本图只校验 τ**（量词收窄）；其余运行时质量参数（档位 / `contextMode` / `sessionEnabledDefault` /
 * 门限常量）与包的一致性尚未收口。无包（试点前）→ 放行，语义逐位不变。
 *
 * 纯函数：无 IO、无 env 读取，env 的值由调用方传入。
 */

export type GatePackageRejectedReason = 'tau_mismatch' | 'tau_unrecorded';

export type GatePackageLoadVerdict =
  { loadable: true; tauClaim: number } | { loadable: false; reason: GatePackageRejectedReason };

/**
 * 判定某个签字包能否被加载。
 *
 * - `packageTau === null`（缺键 / `null` / 非有限数）→ `tau_unrecorded`
 * - `packageTau !== runtimeTau` → `tau_mismatch`（**严格相等**：两侧都由同一个 env 数字字面量派生，
 *   不做容差、不做四舍五入 —— 容差就是发明新语义）
 * - 相等 → 可加载
 */
export function judgeGatePackageLoad(input: {
  packageTau: number | null;
  runtimeTau: number;
}): GatePackageLoadVerdict {
  if (input.packageTau === null || !Number.isFinite(input.packageTau)) {
    return { loadable: false, reason: 'tau_unrecorded' };
  }
  if (input.packageTau !== input.runtimeTau) {
    return { loadable: false, reason: 'tau_mismatch' };
  }
  return { loadable: true, tauClaim: input.packageTau };
}
