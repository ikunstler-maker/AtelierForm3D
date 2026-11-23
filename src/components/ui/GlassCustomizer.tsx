import React from 'react';
import { TRANSLATIONS } from '../../data/translations';
import {
  ACCENT_SWATCHES,
  CANVAS_BG_SWATCHES,
  DEFAULT_LIGHTING,
  LIGHTING_PRESETS,
  LightingPresetId,
  SurfaceFinish,
  useAtelierStore,
} from '../../store/useAtelierStore';
import {
  IconClose,
  IconThemeMoon,
  IconThemeSun,
} from '../icons/CustomIcons';

export const GlassCustomizer: React.FC = () => {
  const customizerOpen = useAtelierStore((s) => s.customizerOpen);
  const setCustomizerOpen = useAtelierStore((s) => s.setCustomizerOpen);
  const glassSettings = useAtelierStore((s) => s.glassSettings);
  const updateGlassSettings = useAtelierStore((s) => s.updateGlassSettings);
  const language = useAtelierStore((s) => s.language);

  if (!customizerOpen) return null;

  const t = TRANSLATIONS[language];
  const lighting = glassSettings.lighting ?? DEFAULT_LIGHTING;
  const lightingPresets: LightingPresetId[] = [
    'studio',
    'soft',
    'contrast',
    'warm',
  ];
  const lightingSliders: {
    key: 'brightness' | 'direction' | 'warmth';
    label: string;
    min: number;
    max: number;
    step: number;
    format: (v: number) => string;
  }[] = [
    {
      key: 'brightness',
      label: t.customizer.lightBrightness,
      min: 0.4,
      max: 1.8,
      step: 0.05,
      format: (v) => `${Math.round(v * 100)}%`,
    },
    {
      key: 'direction',
      label: t.customizer.lightDirection,
      min: -180,
      max: 180,
      step: 5,
      format: (v) => `${Math.round(v)}°`,
    },
    {
      key: 'warmth',
      label: t.customizer.lightWarmth,
      min: -1,
      max: 1,
      step: 0.05,
      format: (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)),
    },
  ];
  const finishes: SurfaceFinish[] = [
    'animeCel',
    'clay',
    'satin',
    'translucent',
  ];

  return (
    <div
      id="glass-customizer-popover"
      className="fixed top-[calc(var(--header-bottom,60px)+8px)] right-3 z-40 w-[335px] max-w-[calc(100vw-24px)] max-h-[calc(100vh_-_var(--header-bottom,60px)_-_24px)] overflow-y-auto glass-scroll liquid-glass rounded-2xl p-4 space-y-4 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider">
          {t.customizer.title}
        </h3>
        <button
          id="close-glass-customizer-btn"
          type="button"
          onClick={() => setCustomizerOpen(false)}
          title={t.common.close}
          aria-label={t.common.close}
          className="liquid-glass-pill p-1 rounded-lg opacity-75 hover:opacity-100"
        >
          <IconClose size={14} />
        </button>
      </div>

      {/* Custom Canvas Background Color Picker + Curated Studio Swatches */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium opacity-80">
            {t.customizer.canvasBackground}
          </span>
          <span className="font-mono text-[11px] uppercase opacity-75">
            {glassSettings.canvasBgColor}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CANVAS_BG_SWATCHES.map((sw) => {
            const isSelected =
              glassSettings.canvasBgColor.toLowerCase() ===
              sw.hex.toLowerCase();
            return (
              <button
                key={sw.id}
                type="button"
                title={sw.label}
                onClick={() =>
                  updateGlassSettings({ canvasBgColor: sw.hex })
                }
                className={`w-8 h-8 rounded-xl border border-white/25 transition-transform ${
                  isSelected
                    ? 'scale-110 ring-2 ring-white shadow-lg'
                    : 'opacity-85 hover:opacity-100 hover:scale-105'
                }`}
                style={{ backgroundColor: sw.hex }}
              />
            );
          })}
          <input
            id="customizer-bg-color-input"
            type="color"
            aria-label={t.customizer.canvasBackground}
            value={glassSettings.canvasBgColor}
            onChange={(e) =>
              updateGlassSettings({ canvasBgColor: e.target.value })
            }
            className="w-9 h-8 rounded-xl cursor-pointer bg-transparent border border-white/25"
          />
        </div>

        {/* Toggle Studio Floor Pedestal & Grid */}
        <label className="flex items-center justify-between p-2 rounded-xl liquid-glass-pill cursor-pointer mt-1">
          <span className="text-xs font-medium">
            {t.customizer.showStudioFloor}
          </span>
          <input
            type="checkbox"
            checked={glassSettings.showStudioFloor}
            onChange={(e) =>
              updateGlassSettings({ showStudioFloor: e.target.checked })
            }
            className="rounded accent-sky-400 w-4 h-4 cursor-pointer"
          />
        </label>
      </div>

      {/* Lighting: presets + brightness, direction and warmth */}
      <div className="space-y-1.5 pt-2 border-t border-white/10">
        <div className="text-[11px] font-medium opacity-80">
          {t.customizer.lighting}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {lightingPresets.map((preset) => (
            <button
              key={preset}
              id={`lighting-preset-${preset}-btn`}
              type="button"
              onClick={() =>
                updateGlassSettings({
                  lighting: { preset, ...LIGHTING_PRESETS[preset].defaults },
                })
              }
              className={`py-1.5 px-2 rounded-xl text-xs font-medium transition-all ${
                lighting.preset === preset
                  ? 'liquid-glass-pill-active'
                  : 'liquid-glass-pill opacity-85 hover:opacity-100'
              }`}
            >
              {t.customizer.lightingPresets[preset]}
            </button>
          ))}
        </div>
        {lightingSliders.map((slider) => (
          <div key={slider.key} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="opacity-75 font-medium">{slider.label}</span>
              <span className="font-mono font-semibold tabular-nums">
                {slider.format(lighting[slider.key])}
              </span>
            </div>
            <input
              id={`lighting-${slider.key}-slider`}
              type="range"
              min={slider.min}
              max={slider.max}
              step={slider.step}
              value={lighting[slider.key]}
              onChange={(e) =>
                updateGlassSettings({
                  lighting: {
                    ...lighting,
                    [slider.key]: parseFloat(e.target.value),
                  },
                })
              }
              className="glass-slider"
            />
          </div>
        ))}
      </div>

      {/* Mannequin Surface Finish (Anime Cel-Shading Reference, Matte Clay, Satin Resin, Translucent Shell) */}
      <div className="space-y-1.5 pt-2 border-t border-white/10">
        <div className="text-[11px] font-medium opacity-80">
          {t.customizer.surfaceFinish}
        </div>
        <div className="space-y-1.5">
          {finishes.map((finish) => {
            const isSelected = glassSettings.surfaceFinish === finish;
            return (
              <button
                key={finish}
                id={`surface-finish-${finish}-btn`}
                type="button"
                onClick={() => updateGlassSettings({ surfaceFinish: finish })}
                className={`w-full text-left px-3 py-2 rounded-xl transition-all ${
                  isSelected
                    ? 'liquid-glass-pill-active'
                    : 'liquid-glass-pill opacity-85 hover:opacity-100'
                }`}
              >
                <div className="text-xs font-semibold">
                  {t.customizer.finishes[finish]}
                </div>
                <div className="text-[10px] opacity-70 leading-tight mt-0.5">
                  {t.customizer.finishDescriptions[finish]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme Mode: Dark Liquid Glass vs Light Liquid Glass */}
      <div className="space-y-1.5 pt-2 border-t border-white/10">
        <div className="text-[11px] font-medium opacity-75">
          {t.customizer.themeMode}
        </div>
        <div
          className="grid grid-cols-2 gap-1.5 p-1 rounded-xl border border-white/10"
          style={{ background: 'var(--glass-bg-elevated)' }}
        >
          <button
            id="theme-dark-btn"
            type="button"
            onClick={() => updateGlassSettings({ theme: 'dark' })}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
              glassSettings.theme === 'dark'
                ? 'liquid-glass-pill-active'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <IconThemeMoon size={14} />
            <span>{t.customizer.darkGlass}</span>
          </button>
          <button
            id="theme-light-btn"
            type="button"
            onClick={() => updateGlassSettings({ theme: 'light' })}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
              glassSettings.theme === 'light'
                ? 'liquid-glass-pill-active'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            <IconThemeSun size={14} />
            <span>{t.customizer.lightGlass}</span>
          </button>
        </div>
      </div>

      {/* Accent Palette Swatches (5 curated hues) */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium opacity-75">
          {t.customizer.accentColor}
        </div>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {ACCENT_SWATCHES.map((swatch) => {
            const isSelected = glassSettings.accentHex === swatch.hex;
            return (
              <button
                key={swatch.id}
                id={`accent-swatch-${swatch.id}`}
                type="button"
                title={swatch.label}
                onClick={() =>
                  updateGlassSettings({
                    accentHex: swatch.hex,
                    accentRgb: swatch.rgb,
                  })
                }
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform ${
                  isSelected
                    ? 'scale-110 ring-2 ring-white shadow-lg'
                    : 'opacity-80 hover:opacity-100 hover:scale-105'
                }`}
                style={{ backgroundColor: swatch.hex }}
              >
                {isSelected && (
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-950" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Backdrop Blur Slider (8px to 32px) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="opacity-75 font-medium">
            {t.customizer.backdropBlur}
          </span>
          <span className="font-mono font-semibold tabular-nums">
            {glassSettings.blurPx}px
          </span>
        </div>
        <input
          id="glass-blur-slider"
          type="range"
          min={8}
          max={32}
          step={1}
          value={glassSettings.blurPx}
          onChange={(e) =>
            updateGlassSettings({ blurPx: parseInt(e.target.value, 10) })
          }
          className="glass-slider"
        />
      </div>

      {/* Glass Panel Opacity Slider (0.35 to 0.85) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="opacity-75 font-medium">
            {t.customizer.panelOpacity}
          </span>
          <span className="font-mono font-semibold tabular-nums">
            {Math.round(glassSettings.opacity * 100)}%
          </span>
        </div>
        <input
          id="glass-opacity-slider"
          type="range"
          min={0.35}
          max={0.85}
          step={0.01}
          value={glassSettings.opacity}
          onChange={(e) =>
            updateGlassSettings({ opacity: parseFloat(e.target.value) })
          }
          className="glass-slider"
        />
      </div>
    </div>
  );
};
