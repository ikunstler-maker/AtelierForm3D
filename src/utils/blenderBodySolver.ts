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
  targets: Record<string, number>
): Record<string, number> {
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
