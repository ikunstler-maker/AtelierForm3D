import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NEUTRAL_PRESETS, PresetId } from '../../data/neutralPresets';
import { TRANSLATIONS } from '../../data/translations';
import {
  HeadDisplayMode,
  UserPresetId,
  isUserPresetId,
  useAtelierStore,
} from '../../store/useAtelierStore';
import { PresetManager } from './PresetManager';
import {
  IconAnimeSparkle,
  IconAtelierBrand,
  IconExportJson,
  IconFaceSculpt,
  IconFitVerify,
  IconGenderFemale,
  IconGenderMale,
  IconBodyShape,
  IconGlassSliders,
  IconImportJson,
  IconReset,
} from '../icons/CustomIcons';

export const GlassHeader: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const gender = useAtelierStore((s) => s.gender);
  const activePresetId = useAtelierStore((s) => s.activePresetId);
  const measurements = useAtelierStore((s) => s.measurements);
  const userPresets = useAtelierStore((s) => s.userPresets);
  const bodyShape = useAtelierStore((s) => s.glassSettings.bodyShape);
  const bodyModel = useAtelierStore((s) => s.glassSettings.bodyModel);
  const selectUserPreset = useAtelierStore((s) => s.selectUserPreset);
  const appearance = useAtelierStore((s) => s.appearance);
  const updateAppearance = useAtelierStore((s) => s.updateAppearance);
  const casPanelOpen = useAtelierStore((s) => s.casPanelOpen);
  const garmentInputsCm = useAtelierStore((s) => s.garmentInputsCm);
  const isFlatMode = useAtelierStore((s) => s.isFlatMode);
  const unit = useAtelierStore((s) => s.unit);
  const language = useAtelierStore((s) => s.language);
  const fitPanelOpen = useAtelierStore((s) => s.fitPanelOpen);
  const customizerOpen = useAtelierStore((s) => s.customizerOpen);
  const bodyPanelOpen = useAtelierStore((s) => s.bodyPanelOpen);
  const canvasBgColor = useAtelierStore((s) => s.glassSettings.canvasBgColor);
  const updateGlassSettings = useAtelierStore((s) => s.updateGlassSettings);

  const setGender = useAtelierStore((s) => s.setGender);
  const selectPreset = useAtelierStore((s) => s.selectPreset);
  const resetCurrentPreset = useAtelierStore((s) => s.resetCurrentPreset);
  const setCasPanelOpen = useAtelierStore((s) => s.setCasPanelOpen);
  const setUnit = useAtelierStore((s) => s.setUnit);
  const setLanguage = useAtelierStore((s) => s.setLanguage);
  const setFitPanelOpen = useAtelierStore((s) => s.setFitPanelOpen);
  const setCustomizerOpen = useAtelierStore((s) => s.setCustomizerOpen);
  const setBodyPanelOpen = useAtelierStore((s) => s.setBodyPanelOpen);
  const importProfileData = useAtelierStore((s) => s.importProfileData);
  const setHeaderBottomPx = useAtelierStore((s) => s.setHeaderBottomPx);
  const headerRef = useRef<HTMLElement | null>(null);
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1100
  );
  const [moreOpen, setMoreOpen] = useState(false);

  const t = TRANSLATIONS[language];

  const handleExportJson = () => {
    const payload = {
      app: 'AtelierForm 3D',
      version: '2.1.0',
      exportedAt: new Date().toISOString(),
      gender,
      preset: activePresetId,
      measurements,
      appearance,
      isFlatMode,
      garmentInputsCm,
      bodyShape,
      bodyModel,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atelierform3d-${gender}-${activePresetId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || '{}'));
        if (parsed && typeof parsed === 'object') {
          importProfileData({
            gender: parsed.gender,
            measurements: parsed.measurements,
            appearance: parsed.appearance,
            garmentInputsCm: parsed.garmentInputsCm,
            isFlatMode: parsed.isFlatMode,
            bodyShape: parsed.bodyShape,
            bodyModel: parsed.bodyModel,
          });
        }
      } catch {
        // Ignore invalid JSON file
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const cycleHeadMode = () => {
    const order: HeadDisplayMode[] = [
      'baldMannequin',
      'headless',
      'animeFull',
    ];
    const nextIdx =
      (order.indexOf(appearance.headDisplayMode) + 1) % order.length;
    updateAppearance({ headDisplayMode: order[nextIdx] });
  };

  const activeGarmentCount = Object.keys(garmentInputsCm).length;


  // Track the narrow layout (rare controls move into the "More" popover).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1099px)');
    const onChange = () => setIsNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isNarrow) setMoreOpen(false);
  }, [isNarrow]);

  // Publish the header's bottom edge so panels and the camera can avoid it.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => {
      const bottom = Math.ceil(el.getBoundingClientRect().bottom);
      document.documentElement.style.setProperty('--header-bottom', `${bottom}px`);
      setHeaderBottomPx(bottom);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [setHeaderBottomPx]);

  const labelCls = isNarrow ? 'inline' : 'hidden sm:inline';
  const btnBase =
    'liquid-glass-pill px-2 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-medium whitespace-nowrap';

  const unitToggle = (
    <div
      className="flex items-center p-0.5 rounded-xl border border-white/10"
      style={{ background: 'var(--glass-bg-elevated)' }}
    >
      {(['cm', 'in'] as const).map((u) => (
        <button
          key={u}
          id={`unit-${u}-btn`}
          type="button"
          onClick={() => setUnit(u)}
          className={`px-2 py-1 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-all ${
            unit === u ? 'liquid-glass-pill-active' : 'opacity-70 hover:opacity-100'
          }`}
        >
          {t.units[u]}
        </button>
      ))}
    </div>
  );

  const langToggle = (
    <div
      className="flex items-center p-0.5 rounded-xl border border-white/10"
      style={{ background: 'var(--glass-bg-elevated)' }}
    >
      {(['ua', 'en'] as const).map((l) => (
        <button
          key={l}
          id={`lang-${l}-btn`}
          type="button"
          onClick={() => setLanguage(l)}
          className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
            language === l ? 'liquid-glass-pill-active' : 'opacity-70 hover:opacity-100'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );

  const exportBtn = (
    <button
      id="export-json-btn"
      type="button"
      onClick={handleExportJson}
      title={t.header.exportJson}
      aria-label={t.header.exportJson}
      className={btnBase}
    >
      <IconExportJson size={15} />
      <span className={labelCls}>{t.header.exportLabel}</span>
    </button>
  );

  const importBtn = (
    <button
      id="import-json-btn"
      type="button"
      onClick={() => fileInputRef.current?.click()}
      title={t.header.importJson}
      aria-label={t.header.importJson}
      className={btnBase}
    >
      <IconImportJson size={15} />
      <span className={labelCls}>{t.header.importLabel}</span>
    </button>
  );

  const bgPicker = (
    <label
      title={t.header.bgColorTooltip}
      className="liquid-glass-pill px-2 py-1 rounded-xl flex items-center gap-1.5 cursor-pointer text-xs whitespace-nowrap"
    >
      <input
        id="header-bg-color-picker"
        type="color"
        aria-label={t.header.bgColorTooltip}
        value={canvasBgColor}
        onChange={(e) => updateGlassSettings({ canvasBgColor: e.target.value })}
        className="w-5 h-5 rounded-md cursor-pointer border border-white/25 bg-transparent"
      />
      <span className="font-mono text-[11px] uppercase hidden 2xl:inline opacity-80">
        {canvasBgColor}
      </span>
      {isNarrow && <span>{t.customizer.canvasBackground}</span>}
    </label>
  );

  return (
    <header
      ref={headerRef}
      id="atelier-glass-header"
      className="fixed top-2 left-2 right-2 z-30 liquid-glass rounded-2xl px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5"
    >
      {/* Brand Title & Subtitle */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/20 shadow-inner"
          style={{
            background: 'rgba(var(--accent-rgb), 0.18)',
            color: 'var(--accent-primary)',
          }}
        >
          <IconAtelierBrand size={18} />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight leading-tight whitespace-nowrap">
            {t.appTitle}
          </h1>
          <p className="text-[11px] opacity-70 hidden 2xl:block leading-tight">
            {t.appSubtitle}
          </p>
        </div>
      </div>

      {/* Center Controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div
          className="flex items-center p-0.5 rounded-xl border border-white/10"
          style={{ background: 'var(--glass-bg-elevated)' }}
        >
          <button
            id="gender-female-btn"
            type="button"
            onClick={() => setGender('female')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              gender === 'female'
                ? 'liquid-glass-pill-active'
                : 'opacity-75 hover:opacity-100'
            }`}
          >
            <IconGenderFemale size={14} />
            <span>{t.gender.female}</span>
          </button>
          <button
            id="gender-male-btn"
            type="button"
            onClick={() => setGender('male')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              gender === 'male'
                ? 'liquid-glass-pill-active'
                : 'opacity-75 hover:opacity-100'
            }`}
          >
            <IconGenderMale size={14} />
            <span>{t.gender.male}</span>
          </button>
        </div>

        {/* Body preset selector */}
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="preset-selector"
            className="text-[11px] opacity-70 hidden 2xl:inline whitespace-nowrap"
          >
            {t.presets.label}
          </label>
          <select
            id="preset-selector"
            aria-label={t.presets.label}
            value={activePresetId}
            onChange={(e) => {
              const val = e.target.value;
              if (isUserPresetId(val)) {
                selectUserPreset(val as UserPresetId);
              } else if (val !== 'custom') {
                selectPreset(val as PresetId);
              }
            }}
            className="liquid-glass-pill rounded-xl px-2 py-1.5 text-xs font-medium outline-none cursor-pointer bg-transparent max-w-[170px]"
          >
            {activePresetId === 'custom' && (
              <option value="custom" className="bg-slate-900 text-white">
                {t.presets.custom}
              </option>
            )}
            {NEUTRAL_PRESETS.map((preset) => (
              <option
                key={preset.id}
                value={preset.id}
                className="bg-slate-900 text-white"
              >
                {t.presets[preset.id]}
              </option>
            ))}
            {userPresets.length > 0 && (
              <optgroup
                label={t.myPresets.group}
                className="bg-slate-900 text-white"
              >
                {userPresets.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    className="bg-slate-900 text-white"
                  >
                    {p.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <button
            id="reset-preset-btn"
            type="button"
            onClick={resetCurrentPreset}
            title={t.header.resetPreset}
            aria-label={t.header.resetPreset}
            className={`${btnBase} opacity-80 hover:opacity-100`}
          >
            <IconReset size={15} />
            <span className="hidden sm:inline">{t.header.resetLabel}</span>
          </button>
        </div>

        <PresetManager />

        <button
          id="cycle-head-mode-btn"
          type="button"
          onClick={cycleHeadMode}
          title={t.header.headModeTooltip}
          aria-label={t.header.headModeTooltip}
          className={btnBase}
        >
          <IconFaceSculpt size={15} />
          <span className="hidden 2xl:inline">
            {t.cas.headModes[appearance.headDisplayMode]}
          </span>
        </button>

        {!isNarrow && bgPicker}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5">
        <button
          id="toggle-cas-panel-btn"
          type="button"
          onClick={() => setCasPanelOpen(!casPanelOpen)}
          title={t.header.casStudio}
          aria-label={t.header.casStudio}
          className={`${btnBase} transition-all ${
            casPanelOpen ? 'liquid-glass-pill-active' : ''
          }`}
        >
          <IconAnimeSparkle size={15} />
          <span className="hidden 2xl:inline">{t.header.casStudio}</span>
        </button>

        <button
          id="toggle-fit-panel-btn"
          type="button"
          onClick={() => setFitPanelOpen(!fitPanelOpen)}
          title={t.header.fitCheck}
          aria-label={t.header.fitCheck}
          className={`${btnBase} transition-all ${
            fitPanelOpen ? 'liquid-glass-pill-active' : ''
          }`}
        >
          <IconFitVerify size={15} />
          <span className="hidden 2xl:inline">{t.header.fitCheck}</span>
          {activeGarmentCount > 0 && (
            <span
              className="px-1.5 rounded-full text-[10px] font-mono font-bold tabular-nums"
              style={{ background: 'var(--accent-primary)', color: '#0f172a' }}
            >
              {activeGarmentCount}
            </span>
          )}
        </button>

        {!isNarrow && (
          <>
            {unitToggle}
            {langToggle}
            {exportBtn}
            {importBtn}
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportJson}
          className="hidden"
        />

        <button
          id="toggle-body-panel-btn"
          type="button"
          onClick={() => setBodyPanelOpen(!bodyPanelOpen)}
          title={t.header.bodyShapeTooltip}
          aria-label={t.header.bodyShapeLabel}
          className={`${btnBase} transition-all ${
            bodyPanelOpen ? 'liquid-glass-pill-active' : ''
          }`}
        >
          <IconBodyShape size={15} />
          <span className="hidden sm:inline">{t.header.bodyShapeLabel}</span>
        </button>

        <button
          id="toggle-glass-customizer-btn"
          type="button"
          onClick={() => setCustomizerOpen(!customizerOpen)}
          title={t.header.glassStyle}
          aria-label={t.header.glassStyle}
          className={`${btnBase} transition-all ${
            customizerOpen ? 'liquid-glass-pill-active' : ''
          }`}
        >
          <IconGlassSliders size={16} />
          <span className="hidden sm:inline">{t.header.viewLabel}</span>
        </button>

        {isNarrow && (
          <div className="relative">
            <button
              id="header-more-btn"
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              title={t.header.moreTooltip}
              aria-label={t.header.moreTooltip}
              aria-expanded={moreOpen}
              className={`${btnBase} transition-all ${
                moreOpen ? 'liquid-glass-pill-active' : ''
              }`}
            >
              <span>{t.header.moreLabel}</span>
              <span aria-hidden="true">...</span>
            </button>
            {moreOpen && (
              <div
                id="header-more-popover"
                className="absolute right-0 top-full mt-2 z-50 liquid-glass rounded-2xl p-3 flex flex-col items-stretch gap-2 shadow-2xl w-max max-w-[calc(100vw-24px)]"
              >
                <div className="flex items-center justify-between gap-3">
                  {unitToggle}
                  {langToggle}
                </div>
                {bgPicker}
                {exportBtn}
                {importBtn}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
