/**
 * Turns body measurements and shape sliders into shape key (morph target)
 * weights for the Blender mannequins. The calibration table is written by
 * scripts/blender_base_body_generator.py next to each GLB.
 *
 * scripts/verify_profiles.py mirrors this math; keep both in sync.
 */

type CurvePoints = [number, number][];

export interface BlenderBodyShapeKey {
  /** Slider id, e.g. "muscle", "breastLift". */
  id: string;
  /** Shape key name in the GLB, e.g. "S_muscle". */
  key: string;
  min: number;
  max: number;
}

/** A measure that does not follow its key in a straight line (female full bust). */
export interface BlenderBodyCurve {
  key: string;
  /** Key weight -> cm, all other keys at 0. */
  points: CurvePoints;
  /** Rib cage key and the weight at which `framePoints` was measured. */
  frameKey?: string;
  frameWeight?: number;
  /** Same as `points`, on a much bigger rib cage. */
  framePoints?: CurvePoints;
  /** Key that carries negative weights: its value = -weight * negScale, at most negMax. */
  negKey?: string;
  negScale?: number;
  negMax?: number;
  /** Rib cage key weight -> cm of this measure, curved key at 0. */
  frameCurve?: CurvePoints;
  /** Key weights at which the shape sliders were calibrated. */
  shapeLevels?: number[];
  /** Per shape key: cm change at slider +1 / -1 for every level. */
  shapeEffects?: Record<string, { plus: number[]; minus: number[] }>;
}

export interface BlenderBodyCalibration {
  version: number;
  gender: 'female' | 'male';
  model: string;
  /** Measurements of the model with all weights at 0, in cm. */
  base: Record<string, number>;
  /** Driven measure names, in matrix row order (they match MeasurementKey names). */
  girthOrder: string[];
  /** Shape key names, in matrix column order. */
  girthKeys: string[];
  /** Row = measure, column = key: change in cm when the key weight is 1. */
  matrixCmPerUnit: number[][];
  shapeKeys?: BlenderBodyShapeKey[];
  /** Row = measure, column = shape key: change in cm when the slider is 1. */
  shapeMatrixCmPerUnit?: number[][];
  curveKeys?: Record<string, BlenderBodyCurve>;
  heightKey: {
    name: string;
    cmPerUnit: number;
    stretchFromM: number;
    stretchToM: number;
  };
  landmarksM: Record<string, number>;
  /**
   * Present on the anime body: it follows only a share of the relative
   * difference from the real default profile (`reference`) and stays inside a
   * safe range. Absent on exact bodies.
   */
  stylization?: {
    mode: string;
    response: { totalHeight: number; girths: number };
    maxGirthChange: number;
    reference?: Record<string, number>;
  } | null;
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

/** Value on a piecewise-linear curve; clamped to the curve ends. */
function curveValue(points: CurvePoints, x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / Math.max(1e-9, x1 - x0);
  }
  return points[points.length - 1][1];
}

/** Like curveValue, but continues the end segments in a straight line. */
function curveValueOpen(points: CurvePoints, x: number): number {
  let a: [number, number];
  let b: [number, number];
  if (x <= points[0][0]) {
    [a, b] = [points[0], points[1]];
  } else if (x >= points[points.length - 1][0]) {
    [a, b] = [points[points.length - 2], points[points.length - 1]];
  } else {
    return curveValue(points, x);
  }
  return a[1] + ((b[1] - a[1]) * (x - a[0])) / Math.max(1e-9, b[0] - a[0]);
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
  const reference = st.reference ?? base;
  const out: Record<string, number> = {
    totalHeight:
      base.totalHeight +
      (targets.totalHeight - base.totalHeight) * st.response.totalHeight,
  };
  calibration.girthOrder.forEach((name) => {
    const change = (targets[name] / reference[name] - 1) * st.response.girths;
    const capped = Math.min(
      st.maxGirthChange,
      Math.max(-st.maxGirthChange, change)
    );
    out[name] = base[name] * (1 + capped);
  });
  return out;
}

/** Slider values clamped to their ranges, keyed by shape key name; missing sliders are 0. */
function shapeValues(
  calibration: BlenderBodyCalibration,
  shape: Record<string, number> | undefined
): Record<string, number> {
  const values: Record<string, number> = {};
  (calibration.shapeKeys ?? []).forEach((spec) => {
    const v = Number(shape?.[spec.id] ?? 0) || 0;
    values[spec.key] = Math.min(spec.max, Math.max(spec.min, v));
  });
  return values;
}

/**
 * Shape key weights that make the model match the target measurements (cm)
 * with the given shape sliders. `realTargets` must hold `totalHeight` and every
 * measure in `calibration.girthOrder`; `shape` is keyed by slider id.
 */
export function solveBlenderBodyWeights(
  calibration: BlenderBodyCalibration,
  realTargets: Record<string, number>,
  shape?: Record<string, number>
): Record<string, number> {
  const targets = effectiveBodyTargets(calibration, realTargets);
  const { girthOrder: order, girthKeys: keys, base } = calibration;
  const matrix = calibration.matrixCmPerUnit;
  const curves = calibration.curveKeys ?? {};
  const shapes = shapeValues(calibration, shape);
  const shapeCols = (calibration.shapeKeys ?? []).map((s) => s.key);
  const shapeMatrix = calibration.shapeMatrixCmPerUnit ?? [];
  const weights: Record<string, number> = {};

  // The sliders change the measures a little; the measurement keys take that back.
  const fromShape = (r: number) =>
    shapeCols.reduce(
      (sum, key, c) => sum + (shapeMatrix[r]?.[c] ?? 0) * shapes[key],
      0
    );

  // 1. Straight-line part: every measure except the curved ones.
  const lin = order.map((_, r) => r).filter((r) => !(order[r] in curves));
  const solved = solveLinearSystem(
    lin.map((r) => lin.map((c) => matrix[r][c])),
    lin.map((r) => targets[order[r]] - base[order[r]] - fromShape(r))
  );
  lin.forEach((r, i) => {
    weights[keys[r]] = solved ? solved[i] : 0;
  });

  // 2. Curved part (female full bust): find the weight by halving the interval.
  Object.entries(curves).forEach(([name, curve]) => {
    const r = order.indexOf(name);
    const frameKey = curve.frameKey;
    const others = lin.reduce(
      (sum, c) =>
        keys[c] === frameKey ? sum : sum + matrix[r][c] * weights[keys[c]],
      0
    );
    const measureAt = (w: number) => {
      let f = curveValue(curve.points, w);
      if (frameKey && curve.framePoints && curve.frameCurve) {
        const u = weights[frameKey];
        const grow0 = f - curveValue(curve.points, 0);
        const growA =
          curveValue(curve.framePoints, w) - curveValue(curve.framePoints, 0);
        f =
          curveValueOpen(curve.frameCurve, u) +
          grow0 +
          (u / (curve.frameWeight ?? 1)) * (growA - grow0);
      }
      let shapePart = fromShape(r);
      if (curve.shapeEffects && curve.shapeLevels) {
        const levels = curve.shapeLevels;
        shapePart = 0;
        Object.entries(shapes).forEach(([key, value]) => {
          const effect = curve.shapeEffects?.[key];
          if (!effect || !value) return;
          const side = value >= 0 ? effect.plus : effect.minus;
          const pts = levels.map((l, i) => [l, side[i]] as [number, number]);
          shapePart += Math.abs(value) * curveValue(pts, w);
        });
      }
      return f + others + shapePart;
    };
    let lo = curve.points[0][0];
    let hi = curve.points[curve.points.length - 1][0];
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (measureAt(mid) < targets[name]) lo = mid;
      else hi = mid;
    }
    const w = (lo + hi) / 2;
    if (curve.negKey) {
      // Negative weights are carried by a second key (female: back to the chest wall).
      weights[curve.key] = Math.max(w, 0);
      weights[curve.negKey] = Math.min(curve.negMax ?? 1, Math.max(-w, 0) * (curve.negScale ?? 0));
    } else {
      weights[curve.key] = w;
    }
  });

  Object.assign(weights, shapes);
  weights[calibration.heightKey.name] =
    (targets.totalHeight - base.totalHeight) / calibration.heightKey.cmPerUnit;
  return weights;
}
