/**
 * Turns body measurements into shape key (morph target) weights for the
 * Blender mannequin. The calibration table is written by
 * scripts/blender_sims_human_generator.py next to each GLB.
 *
 * scripts/verify_profiles.py mirrors this math; keep both in sync.
 */

export interface BlenderBodyCalibration {
  version: number;
  gender: 'female' | 'male';
  model: string;
  /** Measurements of the model with all weights at 0, in cm. */
  base: Record<string, number>;
  /** Girth names, in matrix row order (they match MeasurementKey names). */
  girthOrder: string[];
  /** Shape key names, in matrix column order. */
  girthKeys: string[];
  /** Row = girth, column = key: girth change in cm when the key weight is 1. */
  matrixCmPerUnit: number[][];
  heightKey: {
    name: string;
    cmPerUnit: number;
    stretchFromM: number;
    stretchToM: number;
  };
  landmarksM: Record<string, number>;
  /**
   * Present on the anime body: it follows only a share of the difference from
   * its base size and stays inside a safe range. Absent on exact bodies.
   */
  stylization?: {
    mode: string;
    response: { totalHeight: number; girths: number };
    maxGirthChange: number;
  } | null;
}

/**
 * What the model should show for real measurements (cm). Exact bodies return
 * the targets unchanged; the anime body softens them.
 */
export function effectiveBodyTargets(
  calibration: BlenderBodyCalibration,
  targets: Record<string, number>
): Record<string, number> {
  const st = calibration.stylization;
  if (!st) return { ...targets };
  const base = calibration.base;
  const out: Record<string, number> = {
    totalHeight:
      base.totalHeight +
      (targets.totalHeight - base.totalHeight) * st.response.totalHeight,
  };
  calibration.girthOrder.forEach((name) => {
    const limit = base[name] * st.maxGirthChange;
    const delta = (targets[name] - base[name]) * st.response.girths;
    out[name] = base[name] + Math.min(limit, Math.max(-limit, delta));
  });
  return out;
}

/** Gaussian elimination with partial pivoting. Returns null for a singular matrix. */
export function solveLinearSystem(
  matrix: number[][],
  rhs: number[]
): number[] | null {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col] / a[col][col];
      for (let c = col; c <= n; c++) a[r][c] -= f * a[col][c];
    }
  }
  return a.map((row, i) => row[n] / row[i]);
}

/**
 * Shape key weights that make the model match the target measurements (cm).
 * `targets` must hold `totalHeight` and every girth in `calibration.girthOrder`.
 */
export function solveBlenderBodyWeights(
  calibration: BlenderBodyCalibration,
  realTargets: Record<string, number>
): Record<string, number> {
  const targets = effectiveBodyTargets(calibration, realTargets);
  const weights: Record<string, number> = {};
  const rhs = calibration.girthOrder.map(
    (name) => targets[name] - calibration.base[name]
  );
  const girthWeights = solveLinearSystem(calibration.matrixCmPerUnit, rhs);
  calibration.girthKeys.forEach((key, i) => {
    weights[key] = girthWeights ? girthWeights[i] : 0;
  });
  weights[calibration.heightKey.name] =
    (targets.totalHeight - calibration.base.totalHeight) /
    calibration.heightKey.cmPerUnit;
  return weights;
}
