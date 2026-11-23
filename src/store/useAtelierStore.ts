import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  CameraFocusZone,
  Gender,
  MEASUREMENT_CATEGORIES,
  MEASUREMENTS_MAP,
  MeasurementCategory,
  MeasurementKey,
  MeasurementsRecord,
} from '../data/measurementsSchema';
import { NEUTRAL_PRESETS, PresetId } from '../data/neutralPresets';
import { Language } from '../data/translations';
import { applyMeasurementEdit } from '../utils/linkedMeasures';
import {
  GarmentTemplateId,
  UnitSystem,
  generateSampleGarmentInputs,
} from '../utils/fitCalculator';

export type DisplayMode = 'all' | 'category' | 'active';
export type SurfaceFinish = 'animeCel' | 'clay' | 'satin' | 'translucent';
export type ThemeMode = 'dark' | 'light';
export type HeadDisplayMode = 'baldMannequin' | 'headless' | 'animeFull';

export type AnimeHairstyleId =
  | 'twintails'
  | 'himeLong'
  | 'shortBob'
  | 'spikyShonen'
  | 'highPonytail'
  | 'wolfCut'
  | 'odangoBuns'
  | 'buzzNone';

export type AnimeExpressionId =
  | 'gentleSmile'
  | 'neutralCalm'
  | 'cheerfulOpen'
  | 'seriousCool'
  | 'shyBlush';

export interface CharacterAppearance {
  animeStyleEnabled: boolean;
  headDisplayMode: HeadDisplayMode;
  outlineThickness: number;    // 0.0 to 2.0
  shadowContrast: number;      // 0.3 to 1.5
  // Skin
  skinToneHex: string;
  blushIntensity: number;      // 0.0 to 1.0
  blushColorHex: string;
  // Hair
  hairstyle: AnimeHairstyleId;
  hairColorHex: string;
  hairHighlightHex: string;
  bangsLength: number;         // 0.5 to 1.5
  backHairLength: number;      // 0.5 to 1.6
  hairVolume: number;          // 0.7 to 1.4
  ahogeEnabled: boolean;
  // Eyes & Brows
  eyeColorHex: string;
  eyeSize: number;             // 0.7 to 1.45
  eyeSpacing: number;          // 0.8 to 1.25
  eyeTilt: number;             // -15 to +15 deg
  pupilScale: number;          // 0.7 to 1.3
  sparkleIntensity: number;    // 0.0 to 1.0
  eyelashThickness: number;    // 0.5 to 1.5
  browHeight: number;          // -0.5 to +0.5
  browAngle: number;           // -15 to +15 deg
  // Face Sculpt (CAS Sliders)
  faceRoundness: number;       // 0.6 to 1.4
  chinSharpness: number;       // 0.6 to 1.5 (anime V-chin)
  noseSize: number;            // 0.5 to 1.4
  noseHeight: number;          // -0.4 to +0.4
  mouthWidth: number;          // 0.6 to 1.4
  lipFullness: number;         // 0.5 to 1.5
  lipColorHex: string;
  earSize: number;             // 0.7 to 1.5
  elfEars: boolean;
  expression: AnimeExpressionId;
}

export const SKIN_TONE_SWATCHES = [
  { id: 'aconWhite', label: 'ACON Cel White', hex: '#f4f5f7' },
  { id: 'porcelain', label: 'Porcelain Ivory', hex: '#fde7dd' },
  { id: 'peach', label: 'Sakura Peach', hex: '#f9d4c2' },
  { id: 'warmBeige', label: 'Warm Honey', hex: '#ecc0a5' },
  { id: 'goldenTan', label: 'Sunlit Tan', hex: '#d39c7b' },
  { id: 'caramel', label: 'Amber Caramel', hex: '#ae7656' },
  { id: 'espresso', label: 'Deep Umber', hex: '#764b36' },
];

export const CANVAS_BG_SWATCHES = [
  { id: 'aconGray', label: 'Reference Gray', hex: '#9e9e9e' },
  { id: 'slateStudio', label: 'Cool Slate', hex: '#64748b' },
  { id: 'darkObsidian', label: 'Dark Studio', hex: '#141824' },
  { id: 'softPaper', label: 'Warm Paper', hex: '#dcd6cd' },
  { id: 'pastelSky', label: 'Pastel Sky', hex: '#8faec7' },
  { id: 'sakuraMist', label: 'Sakura Mist', hex: '#b89aa8' },
];

export const HAIR_COLOR_SWATCHES = [
  { id: 'obsidian', hex: '#1e2230', highlight: '#475569' },
  { id: 'sakuraPink', hex: '#f472b6', highlight: '#fbcfe8' },
  { id: 'skyMiku', hex: '#2dd4bf', highlight: '#99f6e4' },
  { id: 'silverMoon', hex: '#e2e8f0', highlight: '#ffffff' },
  { id: 'crimsonRed', hex: '#e11d48', highlight: '#fda4af' },
  { id: 'goldenBlonde', hex: '#f59e0b', highlight: '#fde68a' },
  { id: 'violetMage', hex: '#8b5cf6', highlight: '#ddd6fe' },
  { id: 'chestnutBrown', hex: '#6b3e2e', highlight: '#a8705b' },
];

export const EYE_COLOR_SWATCHES = [
  { id: 'sapphire', hex: '#38bdf8' },
  { id: 'emerald', hex: '#10b981' },
  { id: 'amethyst', hex: '#a855f7' },
  { id: 'ruby', hex: '#f43f5e' },
  { id: 'amberGold', hex: '#f59e0b' },
  { id: 'obsidian', hex: '#334155' },
];

export const DEFAULT_FEMALE_APPEARANCE: CharacterAppearance = {
  animeStyleEnabled: true,
  headDisplayMode: 'baldMannequin',
  outlineThickness: 1.0,
  shadowContrast: 1.0,
  skinToneHex: '#f4f5f7',
  blushIntensity: 0.35,
  blushColorHex: '#fb7185',
  hairstyle: 'twintails',
  hairColorHex: '#f472b6',
  hairHighlightHex: '#fbcfe8',
  bangsLength: 1.05,
  backHairLength: 1.15,
  hairVolume: 1.08,
  ahogeEnabled: true,
  eyeColorHex: '#38bdf8',
  eyeSize: 1.15,
  eyeSpacing: 1.0,
  eyeTilt: 4,
  pupilScale: 1.05,
  sparkleIntensity: 0.9,
  eyelashThickness: 1.15,
  browHeight: 0.0,
  browAngle: 3,
  faceRoundness: 0.94,
  chinSharpness: 1.28,
  noseSize: 0.78,
  noseHeight: 0.0,
  mouthWidth: 0.85,
  lipFullness: 0.88,
  lipColorHex: '#e5989b',
  earSize: 1.0,
  elfEars: false,
  expression: 'gentleSmile',
};

export const DEFAULT_MALE_APPEARANCE: CharacterAppearance = {
  animeStyleEnabled: true,
  headDisplayMode: 'baldMannequin',
  outlineThickness: 1.0,
  shadowContrast: 1.0,
  skinToneHex: '#f4f5f7',
  blushIntensity: 0.15,
  blushColorHex: '#fb7185',
  hairstyle: 'spikyShonen',
  hairColorHex: '#1e2230',
  hairHighlightHex: '#475569',
  bangsLength: 1.0,
  backHairLength: 1.0,
  hairVolume: 1.1,
  ahogeEnabled: true,
  eyeColorHex: '#10b981',
  eyeSize: 1.0,
  eyeSpacing: 1.02,
  eyeTilt: -3,
  pupilScale: 0.95,
  sparkleIntensity: 0.75,
  eyelashThickness: 0.85,
  browHeight: -0.05,
  browAngle: -5,
  faceRoundness: 0.9,
  chinSharpness: 1.22,
  noseSize: 0.9,
  noseHeight: 0.0,
  mouthWidth: 0.92,
  lipFullness: 0.82,
  lipColorHex: '#d88c8a',
  earSize: 1.0,
  elfEars: false,
  expression: 'seriousCool',
};

export interface AccentSwatch {
  id: string;
  label: string;
  hex: string;
  rgb: string;
}

export const ACCENT_SWATCHES: AccentSwatch[] = [
  { id: 'sky', label: 'Arctic Cyan', hex: '#38bdf8', rgb: '56, 189, 248' },
  { id: 'teal', label: 'Emerald Mint', hex: '#2dd4bf', rgb: '45, 212, 191' },
  { id: 'amber', label: 'Champagne Gold', hex: '#f59e0b', rgb: '245, 158, 11' },
  { id: 'coral', label: 'Atelier Coral', hex: '#fb7185', rgb: '251, 113, 133' },
  { id: 'cobalt', label: 'Alpine Cobalt', hex: '#60a5fa', rgb: '96, 165, 250' },
];

export interface GlassSettings {
  theme: ThemeMode;
  accentHex: string;
  accentRgb: string;
  blurPx: number;
  opacity: number;
  surfaceFinish: SurfaceFinish;
  canvasBgColor: string;
  showStudioFloor: boolean;
  /** Which mannequin is shown. Missing in older saved settings: use DEFAULT_BODY_MODEL. */
  bodyModel?: BodyModel;
  /** Skin micro-texture strength for the Blender body, 0..1. */
  skinTexture?: number;
  lighting?: LightingSettings;
  /** Shape sliders of the Blender bodies, keyed by BodyShapeId; missing = 0. */
  bodyShape?: Partial<Record<BodyShapeId, number>>;
}

/** Sliders that change the form but not the tape measures. */
export type BodyShapeId =
  | 'muscle'
  | 'breastLift'
  | 'breastSpacing'
  | 'breastFullness'
  | 'breastWidth'
  | 'breastSag'
  | 'gluteProjection'
  | 'gluteLift'
  | 'hipRoundness'
  | 'hipWidePoint';

export const BODY_SHAPE_SLIDERS: {
  id: BodyShapeId;
  min: number;
  max: number;
  femaleOnly: boolean;
}[] = [
  { id: 'muscle', min: 0, max: 1, femaleOnly: false },
  { id: 'breastLift', min: -1, max: 1, femaleOnly: true },
  { id: 'breastSpacing', min: -1, max: 1, femaleOnly: true },
  { id: 'breastFullness', min: -1, max: 1, femaleOnly: true },
  { id: 'breastWidth', min: -1, max: 1, femaleOnly: true },
  { id: 'breastSag', min: 0, max: 1, femaleOnly: true },
  { id: 'gluteProjection', min: -1, max: 1, femaleOnly: false },
  { id: 'gluteLift', min: -1, max: 1, femaleOnly: false },
  { id: 'hipRoundness', min: -1, max: 1, femaleOnly: false },
  { id: 'hipWidePoint', min: -1, max: 1, femaleOnly: false },
];

/**
 * 'realistic' = exact Blender body (your copy, ±0.5 cm on the driven measures);
 * 'anime' = stylized Blender body (soft response to measurements);
 * 'classic' = procedural mannequin.
 */
export type BodyModel = 'realistic' | 'anime' | 'classic';
export const DEFAULT_BODY_MODEL: BodyModel = 'realistic';

/**
 * Measures the Blender bodies follow (totalHeight + `girthOrder` of the calibration
 * files). scripts/audit_sliders.py reports the same list; keep them in sync.
 */
export const BLENDER_BODY_MEASURES: MeasurementKey[] = [
  'totalHeight',
  'neck',
  'chest',
  'underbust',
  'waist',
  'hip',
  'shoulderWidth',
  'bicep',
  'thigh',
  'calf',
  'head',
  'upperChest',
  'highHip',
  'midThigh',
  'knee',
  'ankle',
  'elbow',
  'forearm',
  'wrist',
  'cervicaleHeight',
  'shoulderHeight',
  'chestHeight',
  'underbustHeight',
  'waistHeight',
  'highHipHeight',
  'hipHeight',
  'crotchHeight',
  'kneeHeight',
  'shoulderToElbow',
  'sleeveFromShoulder',
  'handLength',
  'handWidth',
  'footLength',
  'footWidth',
];
export const DEFAULT_SKIN_TEXTURE = 0.5;

export type LightingPresetId = 'studio' | 'soft' | 'contrast' | 'warm';

export interface LightingSettings {
  preset: LightingPresetId;
  /** Multiplies every light, 0.4..1.8. */
  brightness: number;
  /** Key light angle around the mannequin in degrees; 0 = front, negative = left. */
  direction: number;
  /** -1 = cool, 0 = neutral, 1 = warm. */
  warmth: number;
}

export interface LightingPreset {
  key: number;
  fill: number;
  rim: number;
  ambient: number;
  hemisphere: number;
  defaults: Omit<LightingSettings, 'preset'>;
}

/** 'studio' at its defaults reproduces the original fixed lighting. */
export const LIGHTING_PRESETS: Record<LightingPresetId, LightingPreset> = {
  studio: {
    key: 1.55,
    fill: 0.45,
    rim: 0.75,
    ambient: 0.72,
    hemisphere: 0.8,
    defaults: { brightness: 1, direction: -43, warmth: 0 },
  },
  soft: {
    key: 0.85,
    fill: 0.8,
    rim: 0.35,
    ambient: 1.0,
    hemisphere: 1.0,
    defaults: { brightness: 1, direction: -25, warmth: 0.1 },
  },
  contrast: {
    key: 2.3,
    fill: 0.12,
    rim: 1.2,
    ambient: 0.3,
    hemisphere: 0.35,
    defaults: { brightness: 1, direction: -60, warmth: 0 },
  },
  warm: {
    key: 1.5,
    fill: 0.5,
    rim: 0.7,
    ambient: 0.7,
    hemisphere: 0.75,
    defaults: { brightness: 1, direction: -43, warmth: 0.7 },
  },
};

export const DEFAULT_LIGHTING: LightingSettings = {
  preset: 'studio',
  ...LIGHTING_PRESETS.studio.defaults,
};

/** A body profile saved by the user inside the app. */
export interface UserPreset {
  id: UserPresetId;
  name: string;
  gender: Gender;
  measurements: MeasurementsRecord;
  bodyShape?: Partial<Record<BodyShapeId, number>>;
  bodyModel?: BodyModel;
}

export type UserPresetId = `user:${string}`;

export function isUserPresetId(id: string): id is UserPresetId {
  return id.startsWith('user:');
}

export interface AtelierState {
  gender: Gender;
  activePresetId: PresetId | 'custom' | UserPresetId;
  userPresets: UserPreset[];
  measurements: MeasurementsRecord;
  appearance: CharacterAppearance;
  casPanelOpen: boolean;
  unit: UnitSystem;
  language: Language;
  displayMode: DisplayMode;
  activeCategories: MeasurementCategory[];
  hiddenMeasurements: Partial<Record<MeasurementKey, boolean>>;
  selectedMeasurement: MeasurementKey | null;
  hoveredMeasurement: MeasurementKey | null;
  searchQuery: string;
  leftPanelOpen: boolean;
  fitPanelOpen: boolean;
  customizerOpen: boolean;
  bodyPanelOpen: boolean;
  /** True while the Blender body file is loading (not persisted). */
  mannequinLoading: boolean;
  /** Bottom edge of the header bar in px (measured, not persisted). */
  headerBottomPx: number;
  /** Last own preset that was selected or saved; survives edits (state 'custom'). */
  lastUserPresetId: UserPresetId | null;
  garmentTemplate: GarmentTemplateId;
  isFlatMode: boolean;
  garmentInputsCm: Partial<Record<MeasurementKey, number>>;
  cameraPreset: CameraFocusZone;
  cameraTriggerCount: number;
  autoFocusSelected: boolean;
  glassSettings: GlassSettings;

  // Actions
  setGender: (gender: Gender) => void;
  selectPreset: (presetId: PresetId) => void;
  resetCurrentPreset: () => void;
  saveUserPreset: (name: string) => void;
  updateUserPreset: (id: UserPresetId) => void;
  renameUserPreset: (id: UserPresetId, name: string) => void;
  deleteUserPreset: (id: UserPresetId) => void;
  selectUserPreset: (id: UserPresetId) => void;
  setMeasurement: (key: MeasurementKey, valueCm: number) => void;
  updateAppearance: (partial: Partial<CharacterAppearance>) => void;
  resetAppearance: () => void;
  randomizeAppearance: () => void;
  setCasPanelOpen: (open: boolean) => void;
  setUnit: (unit: UnitSystem) => void;
  setLanguage: (lang: Language) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  toggleCategoryFilter: (category: MeasurementCategory) => void;
  toggleMeasurementVisibility: (key: MeasurementKey) => void;
  setAllMeasurementsVisibility: (visible: boolean) => void;
  setSelectedMeasurement: (key: MeasurementKey | null) => void;
  setHoveredMeasurement: (key: MeasurementKey | null) => void;
  setSearchQuery: (q: string) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setFitPanelOpen: (open: boolean) => void;
  setCustomizerOpen: (open: boolean) => void;
  setBodyPanelOpen: (open: boolean) => void;
  setMannequinLoading: (loading: boolean) => void;
  setHeaderBottomPx: (px: number) => void;
  setGarmentTemplate: (template: GarmentTemplateId) => void;
  setIsFlatMode: (isFlat: boolean) => void;
  setGarmentInput: (key: MeasurementKey, rawCmValue: number | null) => void;
  clearGarmentInputs: () => void;
  loadSampleGarment: () => void;
  setCameraPreset: (preset: CameraFocusZone) => void;
  setAutoFocusSelected: (auto: boolean) => void;
  updateGlassSettings: (partial: Partial<GlassSettings>) => void;
  importProfileData: (payload: {
    gender?: Gender;
    measurements?: Partial<MeasurementsRecord>;
    appearance?: Partial<CharacterAppearance>;
    garmentInputsCm?: Partial<Record<MeasurementKey, number>>;
    isFlatMode?: boolean;
    bodyShape?: Partial<Record<BodyShapeId, number>>;
    bodyModel?: BodyModel;
  }) => void;
}

const DEFAULT_FEMALE_PRESET = NEUTRAL_PRESETS.find((p) => p.id === 'female-m')!;

/** Below this window width the side panels would bury the mannequin. */
export const NARROW_LAYOUT_PX = 1100;

function isNarrowWindow(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < NARROW_LAYOUT_PX;
}

/**
 * Only one right-side panel may be open at a time. Returns the patch that opens
 * `panel` (or closes everything when `open` is false). On narrow windows it also
 * collapses the left measurements panel.
 */
type RightPanel = 'cas' | 'fit' | 'body' | 'customizer';
function rightPanelPatch(
  panel: RightPanel,
  open: boolean
): Partial<AtelierState> {
  const patch: Partial<AtelierState> = {
    casPanelOpen: false,
    fitPanelOpen: false,
    bodyPanelOpen: false,
    customizerOpen: false,
  };
  if (open) {
    if (panel === 'cas') patch.casPanelOpen = true;
    if (panel === 'fit') patch.fitPanelOpen = true;
    if (panel === 'body') patch.bodyPanelOpen = true;
    if (panel === 'customizer') patch.customizerOpen = true;
    if (isNarrowWindow()) patch.leftPanelOpen = false;
  }
  return patch;
}

/** Copy of the current body that a user preset stores. */
function bodySnapshot(
  state: AtelierState
): Pick<UserPreset, 'gender' | 'measurements' | 'bodyShape' | 'bodyModel'> {
  return {
    gender: state.gender,
    measurements: { ...state.measurements },
    bodyShape: { ...(state.glassSettings.bodyShape ?? {}) },
    bodyModel: state.glassSettings.bodyModel ?? DEFAULT_BODY_MODEL,
  };
}

/** State patch that applies a user preset to the live body. */
function snapshotToBody(
  preset: UserPreset,
  state: AtelierState
): Pick<AtelierState, 'gender' | 'activePresetId' | 'measurements' | 'glassSettings'> {
  return {
    gender: preset.gender,
    activePresetId: preset.id,
    measurements: { ...preset.measurements },
    glassSettings: {
      ...state.glassSettings,
      bodyShape: { ...(preset.bodyShape ?? {}) },
      bodyModel: preset.bodyModel ?? state.glassSettings.bodyModel,
    },
  };
}

export const useAtelierStore = create<AtelierState>()(
  persist(
    (set, get) => ({
      gender: 'female',
      activePresetId: 'female-m',
      userPresets: [],
      measurements: { ...DEFAULT_FEMALE_PRESET.measurements },
      appearance: { ...DEFAULT_FEMALE_APPEARANCE },
      casPanelOpen: false,
      unit: 'cm',
      language: 'ua',
      displayMode: 'active',
      activeCategories: [...MEASUREMENT_CATEGORIES],
      hiddenMeasurements: {},
      selectedMeasurement: 'waist',
      hoveredMeasurement: null,
      searchQuery: '',
      // Start collapsed on narrow windows so the mannequin is visible.
      leftPanelOpen: !isNarrowWindow(),
      fitPanelOpen: false,
      customizerOpen: false,
      bodyPanelOpen: false,
      mannequinLoading: false,
      headerBottomPx: 60,
      lastUserPresetId: null,
      garmentTemplate: 'top',
      isFlatMode: false,
      garmentInputsCm: {},
      cameraPreset: 'full',
      cameraTriggerCount: 0,
      autoFocusSelected: false,
      glassSettings: {
        theme: 'dark',
        accentHex: ACCENT_SWATCHES[0].hex,
        accentRgb: ACCENT_SWATCHES[0].rgb,
        blurPx: 20,
        opacity: 0.68,
        surfaceFinish: 'animeCel',
        canvasBgColor: '#9e9e9e',
        showStudioFloor: false,
      },

      setGender: (gender) => {
        const defaultId: PresetId = gender === 'female' ? 'female-m' : 'male-m';
        const preset = NEUTRAL_PRESETS.find((p) => p.id === defaultId)!;
        const defaultApp =
          gender === 'female' ? DEFAULT_FEMALE_APPEARANCE : DEFAULT_MALE_APPEARANCE;
        set((state) => ({
          gender,
          activePresetId: defaultId,
          lastUserPresetId: null,
          measurements: { ...preset.measurements },
          appearance: {
            ...defaultApp,
            headDisplayMode: state.appearance.headDisplayMode,
            skinToneHex: state.appearance.skinToneHex,
          },
          cameraPreset: 'full',
          cameraTriggerCount: state.cameraTriggerCount + 1,
        }));
      },

      selectPreset: (presetId) => {
        const preset = NEUTRAL_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;
        set((state) => ({
          gender: preset.gender,
          activePresetId: preset.id,
          lastUserPresetId: null,
          measurements: { ...preset.measurements },
          cameraTriggerCount: state.cameraTriggerCount + 1,
        }));
      },

      resetCurrentPreset: () => {
        const { activePresetId, gender, userPresets, lastUserPresetId } = get();
        const userId = isUserPresetId(activePresetId)
          ? activePresetId
          : activePresetId === 'custom'
            ? lastUserPresetId
            : null;
        if (userId) {
          const user = userPresets.find((p) => p.id === userId);
          if (user) {
            set((state) => ({
              ...snapshotToBody(user, state),
              lastUserPresetId: user.id,
              hiddenMeasurements: {},
              cameraPreset: 'full',
              cameraTriggerCount: state.cameraTriggerCount + 1,
            }));
            return;
          }
        }
        const fallbackId: PresetId = gender === 'female' ? 'female-m' : 'male-m';
        const targetId =
          activePresetId === 'custom' || isUserPresetId(activePresetId)
            ? fallbackId
            : activePresetId;
        const preset =
          NEUTRAL_PRESETS.find((p) => p.id === targetId) || DEFAULT_FEMALE_PRESET;
        set((state) => ({
          activePresetId: preset.id,
          lastUserPresetId: null,
          measurements: { ...preset.measurements },
          hiddenMeasurements: {},
          cameraPreset: 'full',
          cameraTriggerCount: state.cameraTriggerCount + 1,
        }));
      },

      saveUserPreset: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const state = get();
        const id: UserPresetId = `user:${Date.now()}`;
        const preset: UserPreset = { id, name: trimmed, ...bodySnapshot(state) };
        set({
          userPresets: [...state.userPresets, preset],
          activePresetId: id,
          lastUserPresetId: id,
        });
      },

      updateUserPreset: (id) => {
        const state = get();
        if (!state.userPresets.some((p) => p.id === id)) return;
        set({
          userPresets: state.userPresets.map((p) =>
            p.id === id ? { ...p, ...bodySnapshot(state) } : p
          ),
          activePresetId: id,
          lastUserPresetId: id,
        });
      },

      renameUserPreset: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          userPresets: state.userPresets.map((p) =>
            p.id === id ? { ...p, name: trimmed } : p
          ),
        }));
      },

      deleteUserPreset: (id) =>
        set((state) => ({
          userPresets: state.userPresets.filter((p) => p.id !== id),
          activePresetId:
            state.activePresetId === id ? 'custom' : state.activePresetId,
          lastUserPresetId:
            state.lastUserPresetId === id ? null : state.lastUserPresetId,
        })),

      selectUserPreset: (id) => {
        const preset = get().userPresets.find((p) => p.id === id);
        if (!preset) return;
        set((state) => ({
          ...snapshotToBody(preset, state),
          lastUserPresetId: preset.id,
          cameraTriggerCount: state.cameraTriggerCount + 1,
        }));
      },

      setMeasurement: (key, valueCm) => {
        const meta = MEASUREMENTS_MAP[key];
        if (!meta) return;
        const clamped = Math.min(
          meta.max,
          Math.max(meta.min, Number(valueCm.toFixed(2)))
        );

        set((state) => ({
          measurements: applyMeasurementEdit(state.measurements, key, clamped),
          activePresetId: 'custom',
        }));
      },

      updateAppearance: (partial) =>
        set((state) => ({
          appearance: {
            ...state.appearance,
            ...partial,
          },
        })),

      resetAppearance: () =>
        set((state) => ({
          appearance:
            state.gender === 'female'
              ? { ...DEFAULT_FEMALE_APPEARANCE }
              : { ...DEFAULT_MALE_APPEARANCE },
        })),

      randomizeAppearance: () =>
        set((state) => {
          const styles: AnimeHairstyleId[] = [
            'twintails',
            'himeLong',
            'shortBob',
            'spikyShonen',
            'highPonytail',
            'wolfCut',
            'odangoBuns',
          ];
          const expressions: AnimeExpressionId[] = [
            'gentleSmile',
            'neutralCalm',
            'cheerfulOpen',
            'seriousCool',
            'shyBlush',
          ];
          const randItem = <T,>(arr: T[]): T =>
            arr[Math.floor(Math.random() * arr.length)];
          const randRange = (min: number, max: number) =>
            Number((min + Math.random() * (max - min)).toFixed(2));

          const hair = randItem(HAIR_COLOR_SWATCHES);
          const eye = randItem(EYE_COLOR_SWATCHES);
          const skin = randItem(SKIN_TONE_SWATCHES.slice(0, 4));

          return {
            appearance: {
              ...state.appearance,
              animeStyleEnabled: true,
              headDisplayMode: 'animeFull',
              skinToneHex: skin.hex,
              hairstyle: randItem(styles),
              hairColorHex: hair.hex,
              hairHighlightHex: hair.highlight,
              bangsLength: randRange(0.75, 1.3),
              backHairLength: randRange(0.8, 1.45),
              hairVolume: randRange(0.9, 1.3),
              ahogeEnabled: Math.random() > 0.3,
              eyeColorHex: eye.hex,
              eyeSize: randRange(0.92, 1.32),
              eyeSpacing: randRange(0.9, 1.12),
              eyeTilt: Math.round(randRange(-8, 10)),
              pupilScale: randRange(0.85, 1.2),
              sparkleIntensity: randRange(0.5, 1.0),
              faceRoundness: randRange(0.82, 1.15),
              chinSharpness: randRange(1.0, 1.4),
              noseSize: randRange(0.65, 1.05),
              mouthWidth: randRange(0.75, 1.15),
              elfEars: Math.random() > 0.7,
              expression: randItem(expressions),
            },
          };
        }),

      setCasPanelOpen: (open) => set(rightPanelPatch('cas', open)),

      setUnit: (unit) => set({ unit }),

      setLanguage: (language) => set({ language }),

      setDisplayMode: (displayMode) => set({ displayMode }),

      toggleCategoryFilter: (category) =>
        set((state) => {
          const exists = state.activeCategories.includes(category);
          const next = exists
            ? state.activeCategories.filter((c) => c !== category)
            : [...state.activeCategories, category];
          return {
            activeCategories: next,
            displayMode: 'category',
          };
        }),

      toggleMeasurementVisibility: (key) =>
        set((state) => ({
          hiddenMeasurements: {
            ...state.hiddenMeasurements,
            [key]: !state.hiddenMeasurements[key],
          },
        })),

      setAllMeasurementsVisibility: (visible) =>
        set(() => {
          if (visible) {
            return { hiddenMeasurements: {} };
          }
          const hidden: Partial<Record<MeasurementKey, boolean>> = {};
          (Object.keys(MEASUREMENTS_MAP) as MeasurementKey[]).forEach((k) => {
            hidden[k] = true;
          });
          return { hiddenMeasurements: hidden };
        }),

      setSelectedMeasurement: (key) =>
        set((state) => {
          if (key && state.autoFocusSelected) {
            const meta = MEASUREMENTS_MAP[key];
            return {
              selectedMeasurement: key,
              cameraPreset: meta ? meta.cameraZone : state.cameraPreset,
              cameraTriggerCount: state.cameraTriggerCount + 1,
            };
          }
          return { selectedMeasurement: key };
        }),

      setHoveredMeasurement: (key) => set({ hoveredMeasurement: key }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      setLeftPanelOpen: (leftPanelOpen) =>
        set(
          leftPanelOpen && isNarrowWindow()
            ? {
                leftPanelOpen,
                casPanelOpen: false,
                fitPanelOpen: false,
                bodyPanelOpen: false,
                customizerOpen: false,
              }
            : { leftPanelOpen }
        ),

      setFitPanelOpen: (open) => set(rightPanelPatch('fit', open)),

      setCustomizerOpen: (open) => set(rightPanelPatch('customizer', open)),

      setBodyPanelOpen: (open) => set(rightPanelPatch('body', open)),

      setMannequinLoading: (mannequinLoading) => set({ mannequinLoading }),

      setHeaderBottomPx: (headerBottomPx) => set({ headerBottomPx }),

      setGarmentTemplate: (garmentTemplate) => set({ garmentTemplate }),

      setIsFlatMode: (isFlatMode) =>
        set((state) => {
          if (state.isFlatMode === isFlatMode) return state;
          const converted: Partial<Record<MeasurementKey, number>> = {};
          for (const [k, val] of Object.entries(state.garmentInputsCm)) {
            const key = k as MeasurementKey;
            if (val === undefined || val === null) continue;
            const meta = MEASUREMENTS_MAP[key];
            if (meta?.isGirth) {
              converted[key] = Number(
                (isFlatMode ? val / 2 : val * 2).toFixed(2)
              );
            } else {
              converted[key] = val;
            }
          }
          return {
            isFlatMode,
            garmentInputsCm: converted,
          };
        }),

      setGarmentInput: (key, rawCmValue) =>
        set((state) => {
          const next = { ...state.garmentInputsCm };
          if (
            rawCmValue === null ||
            Number.isNaN(rawCmValue) ||
            rawCmValue <= 0
          ) {
            delete next[key];
          } else {
            next[key] = Number(rawCmValue.toFixed(2));
          }
          return { garmentInputsCm: next };
        }),

      clearGarmentInputs: () => set({ garmentInputsCm: {} }),

      loadSampleGarment: () =>
        set((state) => ({
          garmentInputsCm: generateSampleGarmentInputs(
            state.garmentTemplate,
            state.measurements,
            state.isFlatMode
          ),
        })),

      setCameraPreset: (cameraPreset) =>
        set((state) => ({
          cameraPreset,
          cameraTriggerCount: state.cameraTriggerCount + 1,
        })),

      setAutoFocusSelected: (autoFocusSelected) =>
        set({ autoFocusSelected }),

      updateGlassSettings: (partial) =>
        set((state) => ({
          glassSettings: {
            ...state.glassSettings,
            ...partial,
          },
        })),

      importProfileData: (payload) =>
        set((state) => {
          const nextGender =
            payload.gender === 'male'
              ? 'male'
              : payload.gender === 'female'
              ? 'female'
              : state.gender;
          const nextMeasurements = { ...state.measurements };
          if (payload.measurements) {
            for (const [k, v] of Object.entries(payload.measurements)) {
              const key = k as MeasurementKey;
              const meta = MEASUREMENTS_MAP[key];
              if (meta && typeof v === 'number' && !Number.isNaN(v)) {
                nextMeasurements[key] = Math.min(
                  meta.max,
                  Math.max(meta.min, v)
                );
              }
            }
          }
          let nextGlass = state.glassSettings;
          if (payload.bodyShape && typeof payload.bodyShape === 'object') {
            const shape: Partial<Record<BodyShapeId, number>> = {};
            for (const [k, v] of Object.entries(payload.bodyShape)) {
              if (typeof v === 'number' && Number.isFinite(v)) {
                shape[k as BodyShapeId] = v;
              }
            }
            nextGlass = { ...nextGlass, bodyShape: shape };
          }
          if (
            payload.bodyModel === 'realistic' ||
            payload.bodyModel === 'anime' ||
            payload.bodyModel === 'classic'
          ) {
            nextGlass = { ...nextGlass, bodyModel: payload.bodyModel };
          }
          return {
            gender: nextGender,
            activePresetId: 'custom',
            lastUserPresetId: null,
            measurements: nextMeasurements,
            appearance: payload.appearance
              ? { ...state.appearance, ...payload.appearance }
              : state.appearance,
            isFlatMode: payload.isFlatMode ?? state.isFlatMode,
            glassSettings: nextGlass,
            garmentInputsCm:
              payload.garmentInputsCm ?? state.garmentInputsCm,
            cameraTriggerCount: state.cameraTriggerCount + 1,
          };
        }),
    }),
    {
      name: 'atelier-form-3d-storage-v3',
      partialize: (state) => ({
        gender: state.gender,
        activePresetId: state.activePresetId,
        userPresets: state.userPresets,
        lastUserPresetId: state.lastUserPresetId,
        measurements: state.measurements,
        appearance: state.appearance,
        casPanelOpen: state.casPanelOpen,
        unit: state.unit,
        language: state.language,
        displayMode: state.displayMode,
        activeCategories: state.activeCategories,
        hiddenMeasurements: state.hiddenMeasurements,
        garmentTemplate: state.garmentTemplate,
        isFlatMode: state.isFlatMode,
        garmentInputsCm: state.garmentInputsCm,
        autoFocusSelected: state.autoFocusSelected,
        glassSettings: state.glassSettings,
      }),
    }
  )
);
