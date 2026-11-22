import React from 'react';
import { TRANSLATIONS } from '../../data/translations';
import {
  ACCENT_SWATCHES,
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
  const finishes: SurfaceFinish[] = ['clay', 'satin', 'translucent'];

  return (
    <div
      id="glass-customizer-popover"
      className="fixed top-[68px] right-3 z-40 w-[320px] max-w-[calc(100vw-24px)] liquid-glass rounded-2xl p-4 space-y-4 shadow-2xl"
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
          className="liquid-glass-pill p-1 rounded-lg opacity-75 hover:opacity-100"
        >
          <IconClose size={14} />
        </button>
      </div>

      {/* Theme Mode: Dark Liquid Glass vs Light Liquid Glass */}
      <div className="space-y-1.5">
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

      {/* Mannequin Surface Finish (Matte Clay, Satin Resin, Translucent Shell) */}
      <div className="space-y-1.5 pt-1 border-t border-white/10">
        <div className="text-[11px] font-medium opacity-75">
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
    </div>
  );
};
