export type Gender = 'female' | 'male';

export type MeasurementCategory =
  | 'heights'
  | 'circumferences'
  | 'torso'
  | 'sleeves'
  | 'legs'
  | 'extremities';

export type MeasurementKey =
  // 1. Heights (10)
  | 'totalHeight'
  | 'cervicaleHeight'
  | 'shoulderHeight'
  | 'chestHeight'
  | 'underbustHeight'
  | 'waistHeight'
  | 'highHipHeight'
  | 'hipHeight'
  | 'crotchHeight'
  | 'kneeHeight'
  // 2. Circumferences (17)
  | 'head'
  | 'neck'
  | 'upperChest'
  | 'chest'
  | 'underbust'
  | 'waist'
  | 'highHip'
  | 'hip'
  | 'thigh'
  | 'midThigh'
  | 'knee'
  | 'calf'
  | 'ankle'
  | 'bicep'
  | 'elbow'
  | 'forearm'
  | 'wrist'
  // 3. Torso (8)
  | 'shoulderWidth'
  | 'singleShoulderLength'
  | 'acrossFrontWidth'
  | 'acrossBackWidth'
  | 'frontWaistLength'
  | 'backWaistLength'
  | 'sideTorsoLength'
  | 'torsoLoop'
  // 4. Sleeves (4)
  | 'sleeveFromShoulder'
  | 'sleeveFromNeck'
  | 'sleeveFromArmpit'
  | 'shoulderToElbow'
  // 5. Legs & Rise (7)
  | 'outseamFromWaist'
  | 'outseamFromHighHip'
  | 'inseamLength'
  | 'waistToKneeLength'
  | 'crotchCurveTotal'
  | 'frontRise'
  | 'backRise'
  // 6. Extremities (4)
  | 'handLength'
  | 'handWidth'
  | 'footLength'
  | 'footWidth';

export type CameraFocusZone = 'full' | 'torso' | 'sleeves' | 'legs' | 'back';

export interface MeasurementParameterMeta {
  key: MeasurementKey;
  code: string;
  category: MeasurementCategory;
  min: number;
  max: number;
  step: number;
  defaultFemale: number;
  defaultMale: number;
  isGirth: boolean;
  overlayType: 'ring' | 'line' | 'height';
  cameraZone: CameraFocusZone;
  anchorLandmark: string;
}

export type MeasurementsRecord = Record<MeasurementKey, number>;

export const MEASUREMENT_CATEGORIES: MeasurementCategory[] = [
  'circumferences',
  'torso',
  'sleeves',
  'legs',
  'heights',
  'extremities',
];

export const MEASUREMENTS_SCHEMA: MeasurementParameterMeta[] = [
  // ============================================================================
  // 1. CIRCUMFERENCES (17 parameters)
  // ============================================================================
  {
    key: 'head',
    code: 'C-01',
    category: 'circumferences',
    min: 50,
    max: 64,
    step: 0.5,
    defaultFemale: 56,
    defaultMale: 58,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'torso',
    anchorLandmark: 'Supraorbital ridge to occipital protuberance',
  },
  {
    key: 'neck',
    code: 'C-02',
    category: 'circumferences',
    min: 28,
    max: 50,
    step: 0.5,
    defaultFemale: 34,
    defaultMale: 39.5,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'torso',
    anchorLandmark: 'Base of neck passing over C7 and suprasternal notch',
  },
  {
    key: 'upperChest',
    code: 'C-03',
    category: 'circumferences',
    min: 70,
    max: 135,
    step: 0.5,
    defaultFemale: 86,
    defaultMale: 98,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'torso',
    anchorLandmark: 'Horizontal girth at axillary fold level above full bust',
  },
  {
    key: 'chest',
    code: 'C-04',
    category: 'circumferences',
    min: 72,
    max: 145,
    step: 0.5,
    defaultFemale: 90,
    defaultMale: 100,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'torso',
    anchorLandmark: 'Maximum horizontal girth across bust/chest apex',
  },
  {
    key: 'underbust',
    code: 'C-05',
    category: 'circumferences',
    min: 62,
    max: 130,
    step: 0.5,
    defaultFemale: 75,
    defaultMale: 91,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'torso',
    anchorLandmark: 'Horizontal ribcage girth immediately below bust fold',
  },
  {
    key: 'waist',
    code: 'C-06',
    category: 'circumferences',
    min: 54,
    max: 135,
    step: 0.5,
    defaultFemale: 68,
    defaultMale: 84,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'torso',
    anchorLandmark: 'Narrowest natural waist crease between lower rib and iliac crest',
  },
  {
    key: 'highHip',
    code: 'C-07',
    category: 'circumferences',
    min: 68,
    max: 142,
    step: 0.5,
    defaultFemale: 85,
    defaultMale: 91,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'torso',
    anchorLandmark: 'Pelvic girdle circumference across anterior superior iliac spine',
  },
  {
    key: 'hip',
    code: 'C-08',
    category: 'circumferences',
    min: 78,
    max: 150,
    step: 0.5,
    defaultFemale: 96,
    defaultMale: 98,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'legs',
    anchorLandmark: 'Maximum horizontal seat circumference across trochanter and gluteal apex',
  },
  {
    key: 'thigh',
    code: 'C-09',
    category: 'circumferences',
    min: 42,
    max: 85,
    step: 0.5,
    defaultFemale: 56,
    defaultMale: 58,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'legs',
    anchorLandmark: 'Proximal thigh girth immediately below gluteal fold',
  },
  {
    key: 'midThigh',
    code: 'C-10',
    category: 'circumferences',
    min: 36,
    max: 75,
    step: 0.5,
    defaultFemale: 48,
    defaultMale: 51,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'legs',
    anchorLandmark: 'Midpoint circumference between crotch and patella',
  },
  {
    key: 'knee',
    code: 'C-11',
    category: 'circumferences',
    min: 30,
    max: 54,
    step: 0.5,
    defaultFemale: 36.5,
    defaultMale: 39,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'legs',
    anchorLandmark: 'Articular circumference across mid-patella',
  },
  {
    key: 'calf',
    code: 'C-12',
    category: 'circumferences',
    min: 28,
    max: 52,
    step: 0.5,
    defaultFemale: 35,
    defaultMale: 38,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'legs',
    anchorLandmark: 'Maximum gastrocnemius calf muscle prominence',
  },
  {
    key: 'ankle',
    code: 'C-13',
    category: 'circumferences',
    min: 17,
    max: 32,
    step: 0.5,
    defaultFemale: 21.5,
    defaultMale: 23.5,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'legs',
    anchorLandmark: 'Minimum circumference superior to medial and lateral malleoli',
  },
  {
    key: 'bicep',
    code: 'C-14',
    category: 'circumferences',
    min: 21,
    max: 48,
    step: 0.5,
    defaultFemale: 27.5,
    defaultMale: 33,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'sleeves',
    anchorLandmark: 'Mid-humeral upper arm circumference',
  },
  {
    key: 'elbow',
    code: 'C-15',
    category: 'circumferences',
    min: 19,
    max: 38,
    step: 0.5,
    defaultFemale: 24,
    defaultMale: 28,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'sleeves',
    anchorLandmark: 'Circumference passing over olecranon process',
  },
  {
    key: 'forearm',
    code: 'C-16',
    category: 'circumferences',
    min: 18,
    max: 36,
    step: 0.5,
    defaultFemale: 23,
    defaultMale: 27.5,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'sleeves',
    anchorLandmark: 'Maximum proximal forearm girth',
  },
  {
    key: 'wrist',
    code: 'C-17',
    category: 'circumferences',
    min: 13,
    max: 24,
    step: 0.5,
    defaultFemale: 15.5,
    defaultMale: 17.5,
    isGirth: true,
    overlayType: 'ring',
    cameraZone: 'sleeves',
    anchorLandmark: 'Distal wrist crease across styloid processes',
  },

  // ============================================================================
  // 2. TORSO (8 parameters)
  // ============================================================================
  {
    key: 'shoulderWidth',
    code: 'T-01',
    category: 'torso',
    min: 33,
    max: 56,
    step: 0.5,
    defaultFemale: 39.5,
    defaultMale: 46,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'torso',
    anchorLandmark: 'Bi-acromial span from left acromion to right acromion',
  },
  {
    key: 'singleShoulderLength',
    code: 'T-02',
    category: 'torso',
    min: 10,
    max: 20,
    step: 0.5,
    defaultFemale: 13,
    defaultMale: 15.5,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'torso',
    anchorLandmark: 'Lateral neck base point to acromion tip',
  },
  {
    key: 'acrossFrontWidth',
    code: 'T-03',
    category: 'torso',
    min: 28,
    max: 48,
    step: 0.5,
    defaultFemale: 34,
    defaultMale: 39,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'torso',
    anchorLandmark: 'Anterior armhole crease to armhole crease above bust',
  },
  {
    key: 'acrossBackWidth',
    code: 'T-04',
    category: 'torso',
    min: 30,
    max: 52,
    step: 0.5,
    defaultFemale: 36,
    defaultMale: 42,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'back',
    anchorLandmark: 'Posterior armhole crease to armhole crease across scapulae',
  },
  {
    key: 'frontWaistLength',
    code: 'T-05',
    category: 'torso',
    min: 34,
    max: 55,
    step: 0.5,
    defaultFemale: 42.5,
    defaultMale: 45,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'torso',
    anchorLandmark: 'Side neck base over bust apex down to anterior waist line',
  },
  {
    key: 'backWaistLength',
    code: 'T-06',
    category: 'torso',
    min: 35,
    max: 56,
    step: 0.5,
    defaultFemale: 41,
    defaultMale: 45.5,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'back',
    anchorLandmark: 'Cervicale C7 vertebra along spine to posterior waist line',
  },
  {
    key: 'sideTorsoLength',
    code: 'T-07',
    category: 'torso',
    min: 15,
    max: 30,
    step: 0.5,
    defaultFemale: 20.5,
    defaultMale: 22.5,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'torso',
    anchorLandmark: 'Lateral axillary fold down to natural waist level',
  },
  {
    key: 'torsoLoop',
    code: 'T-08',
    category: 'torso',
    min: 130,
    max: 195,
    step: 0.5,
    defaultFemale: 154,
    defaultMale: 168,
    isGirth: true,
    overlayType: 'line',
    cameraZone: 'torso',
    anchorLandmark: 'Full vertical trunk loop from shoulder through crotch and up back',
  },

  // ============================================================================
  // 3. SLEEVES (4 parameters)
  // ============================================================================
  {
    key: 'sleeveFromShoulder',
    code: 'S-01',
    category: 'sleeves',
    min: 48,
    max: 74,
    step: 0.5,
    defaultFemale: 59,
    defaultMale: 64,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'sleeves',
    anchorLandmark: 'Acromion shoulder tip over outer elbow to ulnar wrist bone',
  },
  {
    key: 'sleeveFromNeck',
    code: 'S-02',
    category: 'sleeves',
    min: 62,
    max: 94,
    step: 0.5,
    defaultFemale: 73.5,
    defaultMale: 81.5,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'sleeves',
    anchorLandmark: 'Center-back C7 vertebra across shoulder tip down to wrist (raglan seam)',
  },
  {
    key: 'sleeveFromArmpit',
    code: 'S-03',
    category: 'sleeves',
    min: 36,
    max: 60,
    step: 0.5,
    defaultFemale: 45,
    defaultMale: 49,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'sleeves',
    anchorLandmark: 'Underarm axillary fold along inner sleeve seam to inner wrist',
  },
  {
    key: 'shoulderToElbow',
    code: 'S-04',
    category: 'sleeves',
    min: 26,
    max: 44,
    step: 0.5,
    defaultFemale: 33,
    defaultMale: 36,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'sleeves',
    anchorLandmark: 'Acromion shoulder point to lateral elbow epicondyle',
  },

  // ============================================================================
  // 4. LEGS & RISE (7 parameters)
  // ============================================================================
  {
    key: 'outseamFromWaist',
    code: 'L-01',
    category: 'legs',
    min: 86,
    max: 126,
    step: 0.5,
    defaultFemale: 103,
    defaultMale: 108,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'legs',
    anchorLandmark: 'Lateral natural waist over outer hip curvature down to ankle malleolus',
  },
  {
    key: 'outseamFromHighHip',
    code: 'L-02',
    category: 'legs',
    min: 78,
    max: 118,
    step: 0.5,
    defaultFemale: 94,
    defaultMale: 99,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'legs',
    anchorLandmark: 'Lateral high-hip waistband level down to outer ankle',
  },
  {
    key: 'inseamLength',
    code: 'L-03',
    category: 'legs',
    min: 62,
    max: 98,
    step: 0.5,
    defaultFemale: 77,
    defaultMale: 81.5,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'legs',
    anchorLandmark: 'Perineal crotch apex along medial leg seam to inner ankle malleolus',
  },
  {
    key: 'waistToKneeLength',
    code: 'L-04',
    category: 'legs',
    min: 48,
    max: 74,
    step: 0.5,
    defaultFemale: 58,
    defaultMale: 61.5,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'legs',
    anchorLandmark: 'Lateral waist line down outer thigh to mid-patella knee level',
  },
  {
    key: 'crotchCurveTotal',
    code: 'L-05',
    category: 'legs',
    min: 50,
    max: 86,
    step: 0.5,
    defaultFemale: 64,
    defaultMale: 68,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'legs',
    anchorLandmark: 'Complete saddle U-curve from center-front waist through perineum to center-back waist',
  },
  {
    key: 'frontRise',
    code: 'L-06',
    category: 'legs',
    min: 20,
    max: 40,
    step: 0.5,
    defaultFemale: 26.5,
    defaultMale: 28.5,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'legs',
    anchorLandmark: 'Center-front waist down abdominal contour to perineal crotch seam',
  },
  {
    key: 'backRise',
    code: 'L-07',
    category: 'legs',
    min: 28,
    max: 50,
    step: 0.5,
    defaultFemale: 37.5,
    defaultMale: 39.5,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'back',
    anchorLandmark: 'Center-back waist over gluteal curve to perineal crotch seam',
  },

  // ============================================================================
  // 5. HEIGHTS (10 parameters)
  // ============================================================================
  {
    key: 'totalHeight',
    code: 'H-01',
    category: 'heights',
    min: 145,
    max: 205,
    step: 0.5,
    defaultFemale: 168,
    defaultMale: 180,
    isGirth: false,
    overlayType: 'height',
    cameraZone: 'full',
    anchorLandmark: 'Floor plane to vertex crown of head',
  },
  {
    key: 'cervicaleHeight',
    code: 'H-02',
    category: 'heights',
    min: 122,
    max: 178,
    step: 0.5,
    defaultFemale: 144,
    defaultMale: 154.5,
    isGirth: false,
    overlayType: 'height',
    cameraZone: 'full',
    anchorLandmark: 'Floor plane to prominent C7 spinous process at neck base',
  },
  {
    key: 'shoulderHeight',
    code: 'H-03',
    category: 'heights',
    min: 116,
    max: 172,
    step: 0.5,
    defaultFemale: 137.5,
    defaultMale: 147.5,
    isGirth: false,
    overlayType: 'height',
    cameraZone: 'full',
    anchorLandmark: 'Floor plane to lateral acromion tip of shoulder',
  },
  {
    key: 'chestHeight',
    code: 'H-04',
    category: 'heights',
    min: 100,
    max: 154,
    step: 0.5,
    defaultFemale: 121,
    defaultMale: 131,
    isGirth: false,
    overlayType: 'height',
    cameraZone: 'torso',
    anchorLandmark: 'Floor plane to bust/chest apex plane',
  },
  {
    key: 'underbustHeight',
    code: 'H-05',
    category: 'heights',
    min: 92,
    max: 146,
    step: 0.5,
    defaultFemale: 113,
    defaultMale: 123,
    isGirth: false,
    overlayType: 'height',
    cameraZone: 'torso',
    anchorLandmark: 'Floor plane to inframammary underbust fold',
  },
  {
    key: 'waistHeight',
    code: 'H-06',
    category: 'heights',
    min: 86,
    max: 134,
    step: 0.5,
    defaultFemale: 105,
    defaultMale: 111.5,
    isGirth: false,
    overlayType: 'height',
    cameraZone: 'torso',
    anchorLandmark: 'Floor plane to natural waist indentation',
  },
  {
    key: 'highHipHeight',
    code: 'H-07',
    category: 'heights',
    min: 78,
    max: 124,
    step: 0.5,
    defaultFemale: 96,
    defaultMale: 102.5,
    isGirth: false,
    overlayType: 'height',
    cameraZone: 'legs',
    anchorLandmark: 'Floor plane to iliac crest high-hip level',
  },
  {
    key: 'hipHeight',
    code: 'H-08',
    category: 'heights',
    min: 70,
    max: 114,
    step: 0.5,
    defaultFemale: 86.5,
    defaultMale: 93,
    isGirth: false,
    overlayType: 'height',
    cameraZone: 'legs',
    anchorLandmark: 'Floor plane to fullest gluteal/trochanteric prominence',
  },
  {
    key: 'crotchHeight',
    code: 'H-09',
    category: 'heights',
    min: 62,
    max: 102,
    step: 0.5,
    defaultFemale: 77,
    defaultMale: 82.5,
    isGirth: false,
    overlayType: 'height',
    cameraZone: 'legs',
    anchorLandmark: 'Floor plane to lowest perineal crotch point',
  },
  {
    key: 'kneeHeight',
    code: 'H-10',
    category: 'heights',
    min: 36,
    max: 62,
    step: 0.5,
    defaultFemale: 46,
    defaultMale: 49.5,
    isGirth: false,
    overlayType: 'height',
    cameraZone: 'legs',
    anchorLandmark: 'Floor plane to mid-patella center of knee joint',
  },

  // ============================================================================
  // 6. EXTREMITIES (4 parameters)
  // ============================================================================
  {
    key: 'handLength',
    code: 'E-01',
    category: 'extremities',
    min: 14,
    max: 24,
    step: 0.5,
    defaultFemale: 17.5,
    defaultMale: 19.5,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'sleeves',
    anchorLandmark: 'Distal wrist crease to dactylion tip of middle finger',
  },
  {
    key: 'handWidth',
    code: 'E-02',
    category: 'extremities',
    min: 6.5,
    max: 12,
    step: 0.5,
    defaultFemale: 8,
    defaultMale: 9.5,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'sleeves',
    anchorLandmark: 'Metacarpal palm breadth across knuckles',
  },
  {
    key: 'footLength',
    code: 'E-03',
    category: 'extremities',
    min: 20,
    max: 32,
    step: 0.5,
    defaultFemale: 24.5,
    defaultMale: 27,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'legs',
    anchorLandmark: 'Pternion posterior heel to acropodion longest toe tip',
  },
  {
    key: 'footWidth',
    code: 'E-04',
    category: 'extremities',
    min: 7.5,
    max: 13,
    step: 0.5,
    defaultFemale: 9,
    defaultMale: 10.5,
    isGirth: false,
    overlayType: 'line',
    cameraZone: 'legs',
    anchorLandmark: 'Metatarsal ball breadth across widest part of foot',
  },
];

export const MEASUREMENTS_MAP: Record<MeasurementKey, MeasurementParameterMeta> =
  MEASUREMENTS_SCHEMA.reduce((acc, item) => {
    acc[item.key] = item;
    return acc;
  }, {} as Record<MeasurementKey, MeasurementParameterMeta>);
