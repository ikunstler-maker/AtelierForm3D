import React from 'react';
import { TRANSLATIONS } from '../../data/translations';
import {
  BODY_SHAPE_SLIDERS,
  BodyModel,
  DEFAULT_BODY_MODEL,
  DEFAULT_SKIN_TEXTURE,
  SKIN_TONE_SWATCHES,
  useAtelierStore,
} from '../../store/useAtelierStore';
import { IconClose } from '../icons/CustomIcons';

type ShapeGroup = 'muscle' | 'breast' | 'glutes';

/** Slider ids decide the sub-heading: muscle / breast* / everything else (glute*, hip*). */
function groupOf(id: string): ShapeGroup {
  if (id === 'muscle') return 'muscle';
  if (id.startsWith('breast')) return 'breast';
  return 'glutes';
}

/** Right-side panel: mannequin type, skin and body shape sliders in one place. */
export const BodyShapePanel: React.FC = () => {
  const bodyPanelOpen = useAtelierStore((s) => s.bodyPanelOpen);
  const setBodyPanelOpen = useAtelierStore((s) => s.setBodyPanelOpen);
  const glassSettings = useAtelierStore((s) => s.glassSettings);
  const updateGlassSettings = useAtelierStore((s) => s.updateGlassSettings);
  const language = useAtelierStore((s) => s.language);
  const skinToneHex = useAtelierStore((s) => s.appearance.skinToneHex);
  const gender = useAtelierStore((s) => s.gender);
  const updateAppearance = useAtelierStore((s) => s.updateAppearance);

  if (!bodyPanelOpen) return null;

  const t = TRANSLATIONS[language];
  const bodyModel = glassSettings.bodyModel ?? DEFAULT_BODY_MODEL;
  const skinTexture = glassSettings.skinTexture ?? DEFAULT_SKIN_TEXTURE;
  const bodyShape = glassSettings.bodyShape ?? {};
  const bodyModels: BodyModel[] = ['realistic', 'anime', 'classic'];
  const shapeSliders = BODY_SHAPE_SLIDERS.filter(
    (s) => !s.femaleOnly || gender === 'female'
  );
  const groups: { id: ShapeGroup; label: string }[] = [
    { id: 'muscle', label: t.bodyPanel.groupMuscle },
    { id: 'breast', label: t.bodyPanel.groupBreast },
    { id: 'glutes', label: t.bodyPanel.groupGlutes },
  ];

  return (
    <aside
      id="body-shape-panel"
      className="fixed right-3 top-[calc(var(--header-bottom,60px)+8px)] bottom-16 z-20 w-[355px] sm:w-[385px] max-w-[calc(100vw-24px)] liquid-glass rounded-2xl flex flex-col overflow-hidden mobile-drawer-panel"
    >
      {/* Header */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-white/10 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider">
            {t.bodyPanel.title}
          </h2>
          <p className="text-[11px] opacity-65">{t.bodyPanel.subtitle}</p>
        </div>
        <button
          id="close-body-panel-btn"
          type="button"
          onClick={() => setBodyPanelOpen(false)}
          title={t.common.close}
          aria-label={t.common.close}
          className="liquid-glass-pill p-1.5 rounded-xl opacity-75 hover:opacity-100"
        >
          <IconClose size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto glass-scroll p-3.5 space-y-4">
        {/* Mannequin type */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium opacity-80">
            {t.customizer.bodyModel}
          </div>
          <div
            className="grid grid-cols-3 gap-1.5 p-1 rounded-xl border border-white/10"
            style={{ background: 'var(--glass-bg-elevated)' }}
          >
            {bodyModels.map((model) => (
              <button
                key={model}
                id={`body-model-${model}-btn`}
                type="button"
                onClick={() => updateGlassSettings({ bodyModel: model })}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  bodyModel === model
                    ? 'liquid-glass-pill-active'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                {t.customizer.bodyModels[model]}
              </button>
            ))}
          </div>
          <div className="text-[10px] opacity-70 leading-tight">
            {t.customizer.bodyModelHints[bodyModel]}
          </div>
        </div>

        {/* Skin colour and texture */}
        <div className="space-y-1.5 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium opacity-80">
              {t.customizer.skinColor}
            </span>
            <input
              id="skin-color-input"
              type="color"
              aria-label={t.customizer.skinColor}
              value={skinToneHex}
              onChange={(e) =>
                updateAppearance({ skinToneHex: e.target.value })
              }
              className="w-16 h-7 rounded-lg cursor-pointer bg-transparent border border-white/20"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SKIN_TONE_SWATCHES.map((sw) => (
              <button
                key={sw.id}
                type="button"
                title={sw.label}
                aria-label={sw.label}
                onClick={() => updateAppearance({ skinToneHex: sw.hex })}
                className={`w-7 h-7 rounded-full border border-white/25 transition-transform ${
                  skinToneHex.toLowerCase() === sw.hex.toLowerCase()
                    ? 'scale-110 ring-2 ring-white'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: sw.hex }}
              />
            ))}
          </div>

          {bodyModel !== 'classic' && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="opacity-75 font-medium">
                  {t.customizer.skinTexture}
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {Math.round(skinTexture * 100)}%
                </span>
              </div>
              <input
                id="skin-texture-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={skinTexture}
                onChange={(e) =>
                  updateGlassSettings({
                    skinTexture: parseFloat(e.target.value),
                  })
                }
                className="glass-slider"
              />
            </div>
          )}
        </div>

        {/* Body shape sliders, grouped */}
        {bodyModel !== 'classic' && (
          <div className="space-y-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                {t.customizer.bodyShape}
              </span>
              <button
                id="body-shape-reset-btn"
                type="button"
                onClick={() => updateGlassSettings({ bodyShape: {} })}
                className="text-[10px] opacity-70 hover:opacity-100 underline"
              >
                {t.customizer.bodyShapeReset}
              </button>
            </div>
            <div className="text-[10px] opacity-70 leading-tight">
              {t.customizer.bodyShapeHint}
            </div>

            {groups.map((group) => {
              const sliders = shapeSliders.filter(
                (s) => groupOf(s.id) === group.id
              );
              if (sliders.length === 0) return null;
              return (
                <div key={group.id} className="space-y-2">
                  <div
                    className="text-[11px] font-semibold"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    {group.label}
                  </div>
                  {sliders.map((slider) => {
                    const value = bodyShape[slider.id] ?? 0;
                    return (
                      <div key={slider.id} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="opacity-75 font-medium">
                            {t.customizer.bodyShapes[slider.id]}
                          </span>
                          <span className="font-mono font-semibold tabular-nums">
                            {Math.round(value * 100)}
                          </span>
                        </div>
                        <input
                          id={`body-shape-${slider.id}-slider`}
                          type="range"
                          min={slider.min}
                          max={slider.max}
                          step={0.05}
                          value={value}
                          onChange={(e) =>
                            updateGlassSettings({
                              bodyShape: {
                                ...bodyShape,
                                [slider.id]: parseFloat(e.target.value),
                              },
                            })
                          }
                          className="glass-slider"
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
