import React, { useState } from 'react';
import { TRANSLATIONS } from '../../data/translations';
import {
  AnimeExpressionId,
  AnimeHairstyleId,
  EYE_COLOR_SWATCHES,
  HAIR_COLOR_SWATCHES,
  SKIN_TONE_SWATCHES,
  useAtelierStore,
} from '../../store/useAtelierStore';
import {
  IconAnimeSparkle,
  IconClose,
  IconDiceRandom,
  IconEyeOpen,
  IconFaceSculpt,
  IconHairScissors,
  IconReset,
  IconTargetFocus,
} from '../icons/CustomIcons';

type CasTabId = 'hair' | 'eyes' | 'face' | 'skin';

const HAIRSTYLE_KEYS: AnimeHairstyleId[] = [
  'twintails',
  'himeLong',
  'shortBob',
  'spikyShonen',
  'highPonytail',
  'wolfCut',
  'odangoBuns',
  'buzzNone',
];

const EXPRESSION_KEYS: AnimeExpressionId[] = [
  'gentleSmile',
  'neutralCalm',
  'cheerfulOpen',
  'seriousCool',
  'shyBlush',
];

export const CharacterStudioPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CasTabId>('hair');

  const casPanelOpen = useAtelierStore((s) => s.casPanelOpen);
  const setCasPanelOpen = useAtelierStore((s) => s.setCasPanelOpen);
  const appearance = useAtelierStore((s) => s.appearance);
  const updateAppearance = useAtelierStore((s) => s.updateAppearance);
  const resetAppearance = useAtelierStore((s) => s.resetAppearance);
  const randomizeAppearance = useAtelierStore((s) => s.randomizeAppearance);
  const setCameraPreset = useAtelierStore((s) => s.setCameraPreset);
  const language = useAtelierStore((s) => s.language);

  if (!casPanelOpen) return null;

  const t = TRANSLATIONS[language];

  const tabs: Array<{ id: CasTabId; label: string; icon: React.ReactNode }> = [
    {
      id: 'hair',
      label: t.cas.tabs.hair,
      icon: <IconHairScissors size={13} />,
    },
    {
      id: 'eyes',
      label: t.cas.tabs.eyes,
      icon: <IconEyeOpen size={13} />,
    },
    {
      id: 'face',
      label: t.cas.tabs.face,
      icon: <IconFaceSculpt size={13} />,
    },
    {
      id: 'skin',
      label: t.cas.tabs.skin,
      icon: <IconAnimeSparkle size={13} />,
    },
  ];

  return (
    <aside
      id="anime-cas-studio-panel"
      className="fixed right-3 top-[68px] bottom-16 z-20 w-[355px] sm:w-[385px] max-w-[calc(100vw-24px)] liquid-glass rounded-2xl flex flex-col overflow-hidden mobile-drawer-panel"
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center border border-white/15"
            style={{
              background: 'rgba(var(--accent-rgb), 0.16)',
              color: 'var(--accent-primary)',
            }}
          >
            <IconAnimeSparkle size={16} />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider">
              {t.cas.title}
            </h2>
            <p className="text-[11px] opacity-65">{t.cas.subtitle}</p>
          </div>
        </div>

        <button
          id="close-cas-panel-btn"
          type="button"
          onClick={() => setCasPanelOpen(false)}
          className="liquid-glass-pill p-1.5 rounded-xl opacity-75 hover:opacity-100"
        >
          <IconClose size={15} />
        </button>
      </div>

      {/* Top Action Bar: Anime Toggle + Randomize + Focus Face + Reset */}
      <div className="px-3.5 py-2.5 border-b border-white/10 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={appearance.animeStyleEnabled}
              onChange={(e) =>
                updateAppearance({ animeStyleEnabled: e.target.checked })
              }
              className="rounded accent-sky-400 w-3.5 h-3.5 cursor-pointer"
            />
            <span>{t.cas.animeModeToggle}</span>
          </label>

          <button
            id="cas-focus-face-btn"
            type="button"
            onClick={() => setCameraPreset('torso')}
            className="liquid-glass-pill px-2 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 opacity-85 hover:opacity-100"
          >
            <IconTargetFocus size={12} />
            <span>{t.cas.focusFaceBtn}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            id="cas-randomize-btn"
            type="button"
            onClick={() => {
              randomizeAppearance();
              setCameraPreset('torso');
            }}
            className="flex-1 liquid-glass-pill-active py-1.5 px-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
          >
            <IconDiceRandom size={14} />
            <span>{t.cas.randomizeBtn}</span>
          </button>

          <button
            id="cas-reset-btn"
            type="button"
            onClick={resetAppearance}
            className="liquid-glass-pill py-1.5 px-2.5 rounded-xl text-xs font-medium flex items-center gap-1 opacity-80 hover:opacity-100"
          >
            <IconReset size={13} />
            <span>{t.cas.resetBtn}</span>
          </button>
        </div>

        {/* 4-Tab Navigation (Hairstyles / Eyes & Brows / Face Sculpt / Skin & Blush) */}
        <div
          className="grid grid-cols-4 gap-1 p-0.5 rounded-xl border border-white/10"
          style={{ background: 'var(--glass-bg-elevated)' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`cas-tab-${tab.id}-btn`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-1.5 px-1.5 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1 truncate transition-all ${
                activeTab === tab.id
                  ? 'liquid-glass-pill-active'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              {tab.icon}
              <span className="truncate">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto glass-scroll px-3.5 py-3 space-y-4">
        {/* ================================================================ */}
        {/* TAB 1: HAIRSTYLES (3D Anime Hair Models, Color, Bangs, Ahoge)    */}
        {/* ================================================================ */}
        {activeTab === 'hair' && (
          <>
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider opacity-75 font-semibold">
                {t.cas.hairstylesLabel}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {HAIRSTYLE_KEYS.map((styleId) => {
                  const isSelected = appearance.hairstyle === styleId;
                  return (
                    <button
                      key={styleId}
                      id={`hairstyle-${styleId}-btn`}
                      type="button"
                      onClick={() => updateAppearance({ hairstyle: styleId })}
                      className={`text-left px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                        isSelected
                          ? 'liquid-glass-pill-active'
                          : 'liquid-glass-pill opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className="leading-snug">
                        {t.cas.hairstyles[styleId]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hair Color Swatches */}
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider opacity-75 font-semibold">
                {t.cas.hairColorLabel}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {HAIR_COLOR_SWATCHES.map((sw) => {
                  const isSelected = appearance.hairColorHex === sw.hex;
                  return (
                    <button
                      key={sw.id}
                      type="button"
                      onClick={() =>
                        updateAppearance({
                          hairColorHex: sw.hex,
                          hairHighlightHex: sw.highlight,
                        })
                      }
                      className={`w-8 h-8 rounded-xl transition-transform ${
                        isSelected
                          ? 'scale-110 ring-2 ring-white shadow-lg'
                          : 'opacity-80 hover:opacity-100 hover:scale-105'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${sw.hex} 55%, ${sw.highlight} 100%)`,
                      }}
                    />
                  );
                })}
                <input
                  type="color"
                  aria-label={t.cas.hairColorLabel}
                  value={appearance.hairColorHex}
                  onChange={(e) =>
                    updateAppearance({ hairColorHex: e.target.value })
                  }
                  className="w-8 h-8 rounded-xl cursor-pointer bg-transparent border border-white/20"
                />
              </div>
            </div>

            {/* Hair Morph Sliders: Bangs Length, Back Hair Length, Volume */}
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.bangsLength}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.bangsLength * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.45}
                  step={0.02}
                  value={appearance.bangsLength}
                  onChange={(e) =>
                    updateAppearance({
                      bangsLength: parseFloat(e.target.value),
                    })
                  }
                  className="glass-slider"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.backHairLength}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.backHairLength * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.55}
                  max={1.6}
                  step={0.02}
                  value={appearance.backHairLength}
                  onChange={(e) =>
                    updateAppearance({
                      backHairLength: parseFloat(e.target.value),
                    })
                  }
                  className="glass-slider"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.hairVolume}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.hairVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.35}
                  step={0.02}
                  value={appearance.hairVolume}
                  onChange={(e) =>
                    updateAppearance({
                      hairVolume: parseFloat(e.target.value),
                    })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Ahoge Top Strand Toggle */}
              <label className="flex items-center justify-between p-2.5 rounded-xl liquid-glass-pill cursor-pointer">
                <span className="text-xs font-medium">{t.cas.ahogeToggle}</span>
                <input
                  type="checkbox"
                  checked={appearance.ahogeEnabled}
                  onChange={(e) =>
                    updateAppearance({ ahogeEnabled: e.target.checked })
                  }
                  className="rounded accent-sky-400 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </>
        )}

        {/* ================================================================ */}
        {/* TAB 2: EYES & BROWS (Anime Iris Color, Scale, Tilt, Sparkles)    */}
        {/* ================================================================ */}
        {activeTab === 'eyes' && (
          <>
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider opacity-75 font-semibold">
                {t.cas.eyeColorLabel}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {EYE_COLOR_SWATCHES.map((sw) => {
                  const isSelected = appearance.eyeColorHex === sw.hex;
                  return (
                    <button
                      key={sw.id}
                      type="button"
                      onClick={() => updateAppearance({ eyeColorHex: sw.hex })}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        isSelected
                          ? 'scale-110 ring-2 ring-white shadow-lg'
                          : 'opacity-80 hover:opacity-100 hover:scale-105'
                      }`}
                      style={{
                        background: `radial-gradient(circle at 35% 35%, #ffffff 8%, ${sw.hex} 48%, #0f172a 95%)`,
                      }}
                    />
                  );
                })}
                <input
                  type="color"
                  aria-label={t.cas.eyeColorLabel}
                  value={appearance.eyeColorHex}
                  onChange={(e) =>
                    updateAppearance({ eyeColorHex: e.target.value })
                  }
                  className="w-8 h-8 rounded-xl cursor-pointer bg-transparent border border-white/20"
                />
              </div>
            </div>

            <div className="space-y-3">
              {/* Eye Size */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.eyeSize}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.eyeSize * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.45}
                  step={0.02}
                  value={appearance.eyeSize}
                  onChange={(e) =>
                    updateAppearance({ eyeSize: parseFloat(e.target.value) })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Eye Spacing */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.eyeSpacing}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.eyeSpacing * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.82}
                  max={1.22}
                  step={0.02}
                  value={appearance.eyeSpacing}
                  onChange={(e) =>
                    updateAppearance({ eyeSpacing: parseFloat(e.target.value) })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Eye Tilt Angle */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.eyeTilt}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {appearance.eyeTilt > 0
                      ? `+${appearance.eyeTilt}°`
                      : `${appearance.eyeTilt}°`}
                  </span>
                </div>
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={1}
                  value={appearance.eyeTilt}
                  onChange={(e) =>
                    updateAppearance({ eyeTilt: parseInt(e.target.value, 10) })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Iris & Pupil Depth */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.pupilScale}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.pupilScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.3}
                  step={0.02}
                  value={appearance.pupilScale}
                  onChange={(e) =>
                    updateAppearance({ pupilScale: parseFloat(e.target.value) })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Starlight Catchlight Sparkles */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.sparkleIntensity}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.sparkleIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={1.2}
                  step={0.05}
                  value={appearance.sparkleIntensity}
                  onChange={(e) =>
                    updateAppearance({
                      sparkleIntensity: parseFloat(e.target.value),
                    })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Eyelash Thickness */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.eyelashThickness}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.eyelashThickness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.5}
                  step={0.05}
                  value={appearance.eyelashThickness}
                  onChange={(e) =>
                    updateAppearance({
                      eyelashThickness: parseFloat(e.target.value),
                    })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Eyebrow Height */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.browHeight}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {appearance.browHeight.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={-0.4}
                  max={0.5}
                  step={0.02}
                  value={appearance.browHeight}
                  onChange={(e) =>
                    updateAppearance({ browHeight: parseFloat(e.target.value) })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Eyebrow Expression Angle */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.browAngle}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {appearance.browAngle > 0
                      ? `+${appearance.browAngle}°`
                      : `${appearance.browAngle}°`}
                  </span>
                </div>
                <input
                  type="range"
                  min={-18}
                  max={18}
                  step={1}
                  value={appearance.browAngle}
                  onChange={(e) =>
                    updateAppearance({
                      browAngle: parseInt(e.target.value, 10),
                    })
                  }
                  className="glass-slider"
                />
              </div>
            </div>
          </>
        )}

        {/* ================================================================ */}
        {/* TAB 3: FACE SCULPT (V-Chin, Cheeks, Nose, Lips, Expressions)     */}
        {/* ================================================================ */}
        {activeTab === 'face' && (
          <>
            {/* Expression Presets */}
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider opacity-75 font-semibold">
                {t.cas.expressionLabel}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {EXPRESSION_KEYS.map((expId) => {
                  const isSelected = appearance.expression === expId;
                  return (
                    <button
                      key={expId}
                      type="button"
                      onClick={() => updateAppearance({ expression: expId })}
                      className={`text-left px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        isSelected
                          ? 'liquid-glass-pill-active'
                          : 'liquid-glass-pill opacity-80 hover:opacity-100'
                      }`}
                    >
                      {t.cas.expressions[expId]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {/* Anime V-Chin Sharpness */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.chinSharpness}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.chinSharpness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.65}
                  max={1.5}
                  step={0.02}
                  value={appearance.chinSharpness}
                  onChange={(e) =>
                    updateAppearance({
                      chinSharpness: parseFloat(e.target.value),
                    })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Cheek Fullness & Face Softness */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.faceRoundness}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.faceRoundness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.3}
                  step={0.02}
                  value={appearance.faceRoundness}
                  onChange={(e) =>
                    updateAppearance({
                      faceRoundness: parseFloat(e.target.value),
                    })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Nose Delicacy / Size */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.noseSize}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.noseSize * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1.35}
                  step={0.02}
                  value={appearance.noseSize}
                  onChange={(e) =>
                    updateAppearance({ noseSize: parseFloat(e.target.value) })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Nose Bridge Elevation */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.noseHeight}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {appearance.noseHeight.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={-0.35}
                  max={0.35}
                  step={0.02}
                  value={appearance.noseHeight}
                  onChange={(e) =>
                    updateAppearance({ noseHeight: parseFloat(e.target.value) })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Mouth Width */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.mouthWidth}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.mouthWidth * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.35}
                  step={0.02}
                  value={appearance.mouthWidth}
                  onChange={(e) =>
                    updateAppearance({ mouthWidth: parseFloat(e.target.value) })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Lip Fullness */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.lipFullness}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.lipFullness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.55}
                  max={1.45}
                  step={0.02}
                  value={appearance.lipFullness}
                  onChange={(e) =>
                    updateAppearance({
                      lipFullness: parseFloat(e.target.value),
                    })
                  }
                  className="glass-slider"
                />
              </div>

              {/* Ear Size & Pointed Elf Ears */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.earSize}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.earSize * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.45}
                  step={0.02}
                  value={appearance.earSize}
                  onChange={(e) =>
                    updateAppearance({ earSize: parseFloat(e.target.value) })
                  }
                  className="glass-slider"
                />
              </div>

              <label className="flex items-center justify-between p-2.5 rounded-xl liquid-glass-pill cursor-pointer">
                <span className="text-xs font-medium">
                  {t.cas.elfEarsToggle}
                </span>
                <input
                  type="checkbox"
                  checked={appearance.elfEars}
                  onChange={(e) =>
                    updateAppearance({ elfEars: e.target.checked })
                  }
                  className="rounded accent-sky-400 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </>
        )}

        {/* ================================================================ */}
        {/* TAB 4: SKIN & BLUSH (Skin Complexion, Cheek Blush, Lip Tint)     */}
        {/* ================================================================ */}
        {activeTab === 'skin' && (
          <>
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-wider opacity-75 font-semibold">
                {t.cas.skinToneLabel}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {SKIN_TONE_SWATCHES.map((sw) => {
                  const isSelected = appearance.skinToneHex === sw.hex;
                  return (
                    <button
                      key={sw.id}
                      type="button"
                      title={sw.label}
                      onClick={() => updateAppearance({ skinToneHex: sw.hex })}
                      className={`h-10 rounded-xl flex items-center justify-center transition-transform border border-white/20 ${
                        isSelected
                          ? 'scale-105 ring-2 ring-white shadow-lg'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: sw.hex }}
                    >
                      <span className="text-[10px] font-semibold text-slate-900/80 drop-shadow">
                        {sw.label.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
                <input
                  type="color"
                  aria-label={t.cas.skinToneLabel}
                  value={appearance.skinToneHex}
                  onChange={(e) =>
                    updateAppearance({ skinToneHex: e.target.value })
                  }
                  className="w-full h-10 rounded-xl cursor-pointer bg-transparent border border-white/20"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="opacity-80">{t.cas.blushIntensity}</span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {Math.round(appearance.blushIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={appearance.blushIntensity}
                  onChange={(e) =>
                    updateAppearance({
                      blushIntensity: parseFloat(e.target.value),
                    })
                  }
                  className="glass-slider"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
