import {
  MEASUREMENTS_MAP,
  MeasurementKey,
  MeasurementsRecord,
} from '../data/measurementsSchema';

/**
 * Linked measures. Some of the 50 measures are geometric consequences of the
 * "primary" ones that drive the 3D body (for example the inner leg length is the
 * same distance as the crotch height). When the user edits a derived measure we
 * move the primaries it depends on; when a primary changes, the derived numbers
 * follow. Everything is incremental (deltas in cm), no absolute constants.
 *
 * This module is pure: it never touches the store and never reads the list of
 * measures the body follows, so it works whatever that list contains.
 */

type Coefs = Partial<Record<MeasurementKey, number>>;

/** Height levels from low to high. Neighbours must stay at least MIN_GAP_CM apart. */
const HEIGHT_ORDER: MeasurementKey[] = [
  'kneeHeight',
  'crotchHeight',
  'hipHeight',
  'highHipHeight',
  'waistHeight',
  'underbustHeight',
  'chestHeight',
  'shoulderHeight',
  'cervicaleHeight',
  'totalHeight',
];

const MIN_GAP_CM = 1;

/** Forward rule: derived measure -> { primary: coefficient }. D += coef * dP. */
const FORWARD: Partial<Record<MeasurementKey, Coefs>> = {
  inseamLength: { crotchHeight: 1 },
  outseamFromWaist: { waistHeight: 1 },
  outseamFromHighHip: { highHipHeight: 1 },
  waistToKneeLength: { waistHeight: 1, kneeHeight: -1 },
  sideTorsoLength: { chestHeight: 1, waistHeight: -1 },
  backWaistLength: { cervicaleHeight: 1, waistHeight: -1 },
  frontWaistLength: { cervicaleHeight: 1, waistHeight: -1 },
  torsoLoop: { shoulderHeight: 2, crotchHeight: -2 },
  frontRise: { waistHeight: 1, crotchHeight: -1 },
  backRise: { waistHeight: 1, crotchHeight: -1 },
  crotchCurveTotal: { waistHeight: 2, crotchHeight: -2 },
  sleeveFromArmpit: { sleeveFromShoulder: 1 },
  sleeveFromNeck: { sleeveFromShoulder: 1, shoulderWidth: 0.5, neck: -0.16 },
  singleShoulderLength: { shoulderWidth: 0.5, neck: -0.16 },
  acrossBackWidth: { shoulderWidth: 0.9 },
  acrossFrontWidth: { shoulderWidth: 0.85 },
};

export const LINKED_MEASURE_KEYS = Object.keys(FORWARD) as MeasurementKey[];

const LINKED_SET = new Set<MeasurementKey>(LINKED_MEASURE_KEYS);

export function isLinkedMeasure(key: MeasurementKey): boolean {
  return LINKED_SET.has(key);
}

const ABOVE_WAIST: MeasurementKey[] = HEIGHT_ORDER.slice(
  HEIGHT_ORDER.indexOf('underbustHeight')
);
const ABOVE_CROTCH_UP_TO_TOTAL: MeasurementKey[] = HEIGHT_ORDER.slice(
  HEIGHT_ORDER.indexOf('hipHeight')
);

/**
 * Which primary measures a derived measure moves when the user edits it.
 * Used for tooltips ("Changes: crotch height").
 */
export const LINKED_MEASURE_MOVES: Record<string, MeasurementKey[]> = {
  inseamLength: ['crotchHeight'],
  outseamFromWaist: ['waistHeight'],
  outseamFromHighHip: ['highHipHeight'],
  waistToKneeLength: ['kneeHeight'],
  sideTorsoLength: ['chestHeight', 'shoulderHeight', 'cervicaleHeight', 'totalHeight'],
  backWaistLength: ABOVE_WAIST,
  frontWaistLength: ABOVE_WAIST,
  torsoLoop: ABOVE_CROTCH_UP_TO_TOTAL,
  frontRise: ['crotchHeight'],
  backRise: ['crotchHeight'],
  crotchCurveTotal: ['crotchHeight'],
  sleeveFromArmpit: ['sleeveFromShoulder'],
  sleeveFromNeck: ['sleeveFromShoulder'],
  singleShoulderLength: ['shoulderWidth'],
  acrossBackWidth: ['shoulderWidth'],
  acrossFrontWidth: ['shoulderWidth'],
};

const round2 = (v: number): number => Math.round(v * 100) / 100;

function clampToSchema(key: MeasurementKey, v: number): number {
  const meta = MEASUREMENTS_MAP[key];
  if (!meta) return v;
  return Math.min(meta.max, Math.max(meta.min, v));
}

type Deltas = Partial<Record<MeasurementKey, number>>;

/**
 * Stretch the heights above `lo`: levels up to and including `hi` move in
 * proportion to their distance from `lo`, levels above `hi` move by the full amount.
 */
function stretchDeltas(
  m: MeasurementsRecord,
  lo: MeasurementKey,
  hi: MeasurementKey,
  amount: number
): Deltas {
  const out: Deltas = {};
  const iLo = HEIGHT_ORDER.indexOf(lo);
  const iHi = HEIGHT_ORDER.indexOf(hi);
  const span = m[hi] - m[lo];
  for (let i = iLo + 1; i < HEIGHT_ORDER.length; i++) {
    const k = HEIGHT_ORDER[i];
    if (i <= iHi) {
      out[k] = span > 1e-9 ? (amount * (m[k] - m[lo])) / span : amount;
    } else {
      out[k] = amount;
    }
  }
  return out;
}

/** Rule C: primary deltas for an edit of derived measure `key` by `dD`. */
function reverseDeltas(
  m: MeasurementsRecord,
  key: MeasurementKey,
  dD: number
): Deltas {
  switch (key) {
    case 'inseamLength':
      return { crotchHeight: dD };
    case 'outseamFromWaist':
      return { waistHeight: dD };
    case 'outseamFromHighHip':
      return { highHipHeight: dD };
    case 'waistToKneeLength':
      return { kneeHeight: -dD };
    case 'sideTorsoLength':
      return stretchDeltas(m, 'waistHeight', 'chestHeight', dD);
    case 'backWaistLength':
    case 'frontWaistLength':
      return stretchDeltas(m, 'waistHeight', 'cervicaleHeight', dD);
    case 'torsoLoop':
      return stretchDeltas(m, 'crotchHeight', 'shoulderHeight', dD / 2);
    case 'frontRise':
    case 'backRise':
      return { crotchHeight: -dD };
    case 'crotchCurveTotal':
      return { crotchHeight: -dD / 2 };
    case 'sleeveFromArmpit':
    case 'sleeveFromNeck':
      return { sleeveFromShoulder: dD };
    case 'singleShoulderLength':
      return { shoulderWidth: 2 * dD };
    case 'acrossBackWidth':
      return { shoulderWidth: dD / 0.9 };
    case 'acrossFrontWidth':
      return { shoulderWidth: dD / 0.85 };
    default:
      return {};
  }
}

/** Rule B: totalHeight grows the whole body, only head and neck keep their size. */
function totalHeightDeltas(m: MeasurementsRecord, dT: number): Deltas {
  const out: Deltas = { totalHeight: dT };
  const c = m.cervicaleHeight;
  for (const k of HEIGHT_ORDER) {
    if (k === 'totalHeight') continue;
    out[k] = c > 1e-9 ? (dT * m[k]) / c : dT;
  }
  return out;
}

/**
 * Largest fraction f in [0, 1] such that m + f * deltas keeps every changed
 * primary in its schema range and the height levels strictly ordered.
 */
function feasibleFraction(m: MeasurementsRecord, deltas: Deltas): number {
  let f = 1;
  const limit = (g0: number, g1: number) => {
    // Constraint: g0 + f * g1 >= 0.
    if (g1 >= 0) return;
    f = Math.min(f, g0 <= 0 ? 0 : g0 / -g1);
  };
  for (const k of Object.keys(deltas) as MeasurementKey[]) {
    const d = deltas[k] ?? 0;
    const meta = MEASUREMENTS_MAP[k];
    if (!meta) continue;
    limit(m[k] - meta.min, d);
    limit(meta.max - m[k], -d);
  }
  for (let i = 0; i < HEIGHT_ORDER.length - 1; i++) {
    const lo = HEIGHT_ORDER[i];
    const hi = HEIGHT_ORDER[i + 1];
    limit(m[hi] - m[lo] - MIN_GAP_CM, (deltas[hi] ?? 0) - (deltas[lo] ?? 0));
  }
  return Number.isFinite(f) ? Math.min(1, Math.max(0, f)) : 0;
}

/**
 * Apply a user edit of one measure and return a new record (the input is not
 * changed). Linked measures move their primaries; primaries update the derived
 * numbers. The edit is scaled down when it would break a range or the order of
 * the height levels; read the achieved value from the returned record.
 */
export function applyMeasurementEdit(
  measurements: MeasurementsRecord,
  key: MeasurementKey,
  newValueCm: number
): MeasurementsRecord {
  const next: MeasurementsRecord = { ...measurements };
  const meta = MEASUREMENTS_MAP[key];
  if (!meta || !Number.isFinite(newValueCm) || !Number.isFinite(measurements[key])) {
    return next;
  }

  const old = measurements[key];
  const target = clampToSchema(key, round2(newValueCm));
  const dEdit = target - old;
  if (Math.abs(dEdit) < 1e-9) return next;

  let deltas: Deltas;
  if (LINKED_SET.has(key)) {
    deltas = reverseDeltas(measurements, key, dEdit);
  } else if (key === 'totalHeight') {
    deltas = totalHeightDeltas(measurements, dEdit);
  } else {
    deltas = { [key]: dEdit };
  }

  const f = feasibleFraction(measurements, deltas);

  // Move the primaries.
  const moved: Deltas = {};
  for (const k of Object.keys(deltas) as MeasurementKey[]) {
    const d = deltas[k] ?? 0;
    const value = clampToSchema(k, round2(measurements[k] + f * d));
    moved[k] = value - measurements[k];
    next[k] = value;
  }

  // Forward rule: every derived measure follows the primaries that moved.
  for (const dKey of LINKED_MEASURE_KEYS) {
    const coefs = FORWARD[dKey] ?? {};
    let sum = 0;
    for (const p of Object.keys(coefs) as MeasurementKey[]) {
      sum += (coefs[p] ?? 0) * (moved[p] ?? 0);
    }
    if (sum !== 0) {
      next[dKey] = clampToSchema(dKey, round2(measurements[dKey] + sum));
    }
  }

  // The edited derived measure shows the value the edit actually achieved.
  if (LINKED_SET.has(key)) {
    next[key] = clampToSchema(key, round2(old + f * dEdit));
  }

  for (const k of Object.keys(next) as MeasurementKey[]) {
    if (!Number.isFinite(next[k])) next[k] = measurements[k];
  }
  return next;
}
