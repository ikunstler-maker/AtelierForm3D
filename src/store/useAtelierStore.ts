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
import {
  GarmentTemplateId,
  UnitSystem,
  generateSampleGarmentInputs,
} from '../utils/fitCalculator';

export type DisplayMode = 'all' | 'category' | 'active';
export type SurfaceFinish = 'clay' | 'satin' | 'translucent';
export type ThemeMode = 'dark' | 'light';

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
  { id: 'cobalt', label: ' Alpine Cobalt', hex: '#60a5fa', rgb: '96, 165, 250' },
];

export interface GlassSettings {
  theme: ThemeMode;
  accentHex: string;
  accentRgb: string;
  blurPx: number;
  opacity: number;
  surfaceFinish: SurfaceFinish;
}

export interface AtelierState {
  gender: Gender;
  activePresetId: PresetId | 'custom';
  measurements: MeasurementsRecord;
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
  setMeasurement: (key: MeasurementKey, valueCm: number) => void;
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
    garmentInputsCm?: Partial<Record<MeasurementKey, number>>;
    isFlatMode?: boolean;
  }) => void;
}

const DEFAULT_FEMALE_PRESET = NEUTRAL_PRESETS.find((p) => p.id === 'female-m')!;

export const useAtelierStore = create<AtelierState>()(
  persist(
    (set, get) => ({
      gender: 'female',
      activePresetId: 'female-m',
      measurements: { ...DEFAULT_FEMALE_PRESET.measurements },
      unit: 'cm',
      language: 'ua',
      displayMode: 'all',
      activeCategories: [...MEASUREMENT_CATEGORIES],
      hiddenMeasurements: {},
      selectedMeasurement: 'waist',
      hoveredMeasurement: null,
      searchQuery: '',
      leftPanelOpen: true,
      fitPanelOpen: false,
      customizerOpen: false,
      garmentTemplate: 'top',
      isFlatMode: false,
      garmentInputsCm: {},
      cameraPreset: 'full',
      cameraTriggerCount: 0,
      autoFocusSelected: true,
      glassSettings: {
        theme: 'dark',
        accentHex: ACCENT_SWATCHES[0].hex,
        accentRgb: ACCENT_SWATCHES[0].rgb,
        blurPx: 20,
        opacity: 0.62,
        surfaceFinish: 'satin',
      },

      setGender: (gender) => {
        const defaultId: PresetId = gender === 'female' ? 'female-m' : 'male-m';
        const preset = NEUTRAL_PRESETS.find((p) => p.id === defaultId)!;
        set((state) => ({
          gender,
          activePresetId: defaultId,
          measurements: { ...preset.measurements },
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
          measurements: { ...preset.measurements },
          cameraTriggerCount: state.cameraTriggerCount + 1,
        }));
      },

      resetCurrentPreset: () => {
        const { activePresetId, gender } = get();
        const fallbackId: PresetId = gender === 'female' ? 'female-m' : 'male-m';
        const targetId = activePresetId === 'custom' ? fallbackId : activePresetId;
        const preset = NEUTRAL_PRESETS.find((p) => p.id === targetId) || DEFAULT_FEMALE_PRESET;
        set((state) => ({
          activePresetId: preset.id,
          measurements: { ...preset.measurements },
          hiddenMeasurements: {},
          cameraPreset: 'full',
          cameraTriggerCount: state.cameraTriggerCount + 1,
        }));
      },

      setMeasurement: (key, valueCm) => {
        const meta = MEASUREMENTS_MAP[key];
        if (!meta) return;
        const clamped = Math.min(meta.max, Math.max(meta.min, Number(valueCm.toFixed(2))));

        set((state) => {
          const next = { ...state.measurements, [key]: clamped };

          // Maintain anatomical consistency when coupled parameters change
          if (key === 'frontRise' || key === 'backRise') {
            next.crotchCurveTotal = Number((next.frontRise + next.backRise).toFixed(1));
          } else if (key === 'crotchCurveTotal') {
            const currentSum = state.measurements.frontRise + state.measurements.backRise;
            const ratio = currentSum > 0 ? state.measurements.frontRise / currentSum : 0.42;
            next.frontRise = Number((clamped * ratio).toFixed(1));
            next.backRise = Number((clamped - next.frontRise).toFixed(1));
          }

          return {
            measurements: next,
            activePresetId: 'custom',
          };
        });
      },

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

      setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),

      setFitPanelOpen: (fitPanelOpen) => set({ fitPanelOpen }),

      setCustomizerOpen: (customizerOpen) => set({ customizerOpen }),

      setGarmentTemplate: (garmentTemplate) => set({ garmentTemplate }),

      setIsFlatMode: (isFlatMode) =>
        set((state) => {
          if (state.isFlatMode === isFlatMode) return state;
          // Convert existing garment inputs for girths between flat (half) and full (x1)
          const converted: Partial<Record<MeasurementKey, number>> = {};
          for (const [k, val] of Object.entries(state.garmentInputsCm)) {
            const key = k as MeasurementKey;
            if (val === undefined || val === null) continue;
            const meta = MEASUREMENTS_MAP[key];
            if (meta?.isGirth) {
              converted[key] = Number((isFlatMode ? val / 2 : val * 2).toFixed(2));
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
          if (rawCmValue === null || Number.isNaN(rawCmValue) || rawCmValue <= 0) {
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

      setAutoFocusSelected: (autoFocusSelected) => set({ autoFocusSelected }),

      updateGlassSettings: (partial) =>
        set((state) => ({
          glassSettings: {
            ...state.glassSettings,
            ...partial,
          },
        })),

      importProfileData: (payload) =>
        set((state) => {
          const nextGender = payload.gender === 'male' ? 'male' : payload.gender === 'female' ? 'female' : state.gender;
          const nextMeasurements = { ...state.measurements };
          if (payload.measurements) {
            for (const [k, v] of Object.entries(payload.measurements)) {
              const key = k as MeasurementKey;
              const meta = MEASUREMENTS_MAP[key];
              if (meta && typeof v === 'number' && !Number.isNaN(v)) {
                nextMeasurements[key] = Math.min(meta.max, Math.max(meta.min, v));
              }
            }
          }
          return {
            gender: nextGender,
            activePresetId: 'custom',
            measurements: nextMeasurements,
            isFlatMode: payload.isFlatMode ?? state.isFlatMode,
            garmentInputsCm: payload.garmentInputsCm ?? state.garmentInputsCm,
            cameraTriggerCount: state.cameraTriggerCount + 1,
          };
        }),
    }),
    {
      name: 'atelier-form-3d-storage-v1',
      partialize: (state) => ({
        gender: state.gender,
        activePresetId: state.activePresetId,
        measurements: state.measurements,
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
