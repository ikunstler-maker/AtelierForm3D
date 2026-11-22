import {
  MEASUREMENTS_MAP,
  MEASUREMENTS_SCHEMA,
  MeasurementKey,
  MeasurementsRecord,
} from '../data/measurementsSchema';

export type FitStatus = 'tight' | 'snug' | 'regular' | 'oversized' | 'unset';

export type GarmentTemplateId = 'top' | 'jacket' | 'trousers' | 'dress' | 'all';

export type UnitSystem = 'cm' | 'in';

export interface FitEvaluationResult {
  key: MeasurementKey;
  bodyCm: number;
  rawInputValue: number | null;
  effectiveGarmentCm: number | null;
  deltaCm: number | null;
  status: FitStatus;
  colorHex: string;
  isMultipliedFlat: boolean;
}

export const FIT_STATUS_COLORS: Record<FitStatus, string> = {
  tight: '#fb7185',     // Coral (< 0 cm)
  snug: '#fbbf24',      // Amber (0 to +2.5 cm)
  regular: '#34d399',   // Mint (+2.5 to +8.0 cm)
  oversized: '#22d3ee', // Cyan (> +8.0 cm)
  unset: '#38bdf8',     // Default accent
};

export const GARMENT_TEMPLATE_KEYS: Record<GarmentTemplateId, MeasurementKey[]> = {
  top: [
    'neck',
    'shoulderWidth',
    'singleShoulderLength',
    'chest',
    'underbust',
    'waist',
    'highHip',
    'acrossFrontWidth',
    'acrossBackWidth',
    'frontWaistLength',
    'backWaistLength',
    'sideTorsoLength',
    'sleeveFromShoulder',
    'sleeveFromNeck',
    'sleeveFromArmpit',
    'bicep',
    'wrist',
  ],
  jacket: [
    'neck',
    'shoulderWidth',
    'singleShoulderLength',
    'upperChest',
    'chest',
    'waist',
    'hip',
    'acrossFrontWidth',
    'acrossBackWidth',
    'backWaistLength',
    'sleeveFromShoulder',
    'sleeveFromNeck',
    'sleeveFromArmpit',
    'shoulderToElbow',
    'bicep',
    'elbow',
    'forearm',
    'wrist',
  ],
  trousers: [
    'waist',
    'highHip',
    'hip',
    'outseamFromWaist',
    'outseamFromHighHip',
    'inseamLength',
    'waistToKneeLength',
    'frontRise',
    'backRise',
    'crotchCurveTotal',
    'thigh',
    'midThigh',
    'knee',
    'calf',
    'ankle',
  ],
  dress: [
    'shoulderWidth',
    'singleShoulderLength',
    'upperChest',
    'chest',
    'underbust',
    'waist',
    'highHip',
    'hip',
    'frontWaistLength',
    'backWaistLength',
    'sideTorsoLength',
    'waistToKneeLength',
    'outseamFromWaist',
    'sleeveFromShoulder',
    'bicep',
    'wrist',
  ],
  all: MEASUREMENTS_SCHEMA.map((m) => m.key),
};

const CM_PER_INCH = 2.54;

export function cmToUnit(cm: number, unit: UnitSystem): number {
  if (unit === 'in') {
    return Number((cm / CM_PER_INCH).toFixed(2));
  }
  return Number(cm.toFixed(1));
}

export function unitToCm(val: number, unit: UnitSystem): number {
  if (unit === 'in') {
    return Number((val * CM_PER_INCH).toFixed(2));
  }
  return Number(val.toFixed(2));
}

export function formatValueWithUnit(cm: number, unit: UnitSystem): string {
  if (unit === 'in') {
    return `${(cm / CM_PER_INCH).toFixed(1)}"`;
  }
  return `${cm.toFixed(1)} cm`;
}

export function formatDeltaWithUnit(deltaCm: number, unit: UnitSystem): string {
  const converted = unit === 'in' ? deltaCm / CM_PER_INCH : deltaCm;
  const sign = converted > 0 ? '+' : '';
  const suffix = unit === 'in' ? 'in' : 'cm';
  return `${sign}${converted.toFixed(1)} ${suffix}`;
}

/**
 * Classifies delta (garmentCm - bodyCm) into fit status:
 * - Coral (< 0 cm): tight
 * - Amber (0 to +2.5 cm): snug
 * - Mint (> +2.5 to +8.0 cm): regular
 * - Cyan (> +8.0 cm): oversized
 */
export function classifyFitDelta(deltaCm: number): FitStatus {
  if (deltaCm < -0.05) {
    return 'tight';
  }
  if (deltaCm <= 2.5) {
    return 'snug';
  }
  if (deltaCm <= 8.0) {
    return 'regular';
  }
  return 'oversized';
}

/**
 * Evaluates a single measurement parameter against an entered garment size-chart value.
 * Note: rawInputCm is stored in centimeters internally. When `isFlatMode` is true and
 * the parameter is a girth/circumference (`meta.isGirth`), the flat input represents half-girth
 * so effectiveGarmentCm = rawInputCm * 2.
 */
export function evaluateParameterFit(
  key: MeasurementKey,
  bodyMeasurements: MeasurementsRecord,
  garmentInputsCm: Partial<Record<MeasurementKey, number>>,
  isFlatMode: boolean
): FitEvaluationResult {
  const meta = MEASUREMENTS_MAP[key];
  const bodyCm = bodyMeasurements[key];
  const rawVal = garmentInputsCm[key];

  if (rawVal === undefined || rawVal === null || Number.isNaN(rawVal) || rawVal <= 0) {
    return {
      key,
      bodyCm,
      rawInputValue: null,
      effectiveGarmentCm: null,
      deltaCm: null,
      status: 'unset',
      colorHex: FIT_STATUS_COLORS.unset,
      isMultipliedFlat: Boolean(isFlatMode && meta.isGirth),
    };
  }

  const isMultipliedFlat = Boolean(isFlatMode && meta.isGirth);
  const effectiveGarmentCm = isMultipliedFlat ? rawVal * 2 : rawVal;
  const deltaCm = Number((effectiveGarmentCm - bodyCm).toFixed(2));
  const status = classifyFitDelta(deltaCm);

  return {
    key,
    bodyCm,
    rawInputValue: rawVal,
    effectiveGarmentCm,
    deltaCm,
    status,
    colorHex: FIT_STATUS_COLORS[status],
    isMultipliedFlat,
  };
}

/**
 * Generates realistic sample garment measurements (stored as raw input in cm according to isFlatMode)
 * so users can immediately preview tight, snug, regular, and oversized zones on the 3D mannequin.
 */
export function generateSampleGarmentInputs(
  template: GarmentTemplateId,
  body: MeasurementsRecord,
  isFlatMode: boolean
): Partial<Record<MeasurementKey, number>> {
  const keys = GARMENT_TEMPLATE_KEYS[template];
  const sample: Partial<Record<MeasurementKey, number>> = {};

  // Curated realistic ease offsets in cm for demonstration across fit statuses
  const easeMap: Partial<Record<MeasurementKey, number>> = {
    neck: 1.5,              // snug
    shoulderWidth: 2.0,     // snug
    singleShoulderLength: 0.5,
    upperChest: 4.5,        // regular
    chest: 6.0,             // regular
    underbust: 4.0,         // regular
    waist: 3.5,             // regular
    highHip: 4.5,           // regular
    hip: 5.5,               // regular
    acrossFrontWidth: 1.5,  // snug
    acrossBackWidth: 2.0,   // snug
    frontWaistLength: 1.0,  // snug
    backWaistLength: 1.0,   // snug
    sideTorsoLength: 0.5,   // snug
    sleeveFromShoulder: 1.5,// snug
    sleeveFromNeck: 2.0,    // snug
    sleeveFromArmpit: 1.0,  // snug
    shoulderToElbow: 0.5,
    bicep: 5.0,             // regular
    elbow: 4.0,             // regular
    forearm: 3.5,           // regular
    wrist: 2.0,             // snug
    outseamFromWaist: 1.5,  // snug
    outseamFromHighHip: 1.5,
    inseamLength: -1.0,     // tight/short example
    waistToKneeLength: 1.0,
    frontRise: 1.5,         // snug
    backRise: 2.0,          // snug
    crotchCurveTotal: 3.5,  // regular
    thigh: 4.5,             // regular
    midThigh: 4.0,          // regular
    knee: 5.0,              // regular
    calf: 6.5,              // regular
    ankle: 9.5,             // oversized leg opening
  };

  for (const key of keys) {
    const meta = MEASUREMENTS_MAP[key];
    const bodyVal = body[key];
    const ease = easeMap[key] ?? 2.0;
    const fullTarget = bodyVal + ease;
    const rawValue = isFlatMode && meta.isGirth ? fullTarget / 2 : fullTarget;
    sample[key] = Number(rawValue.toFixed(1));
  }

  return sample;
}
