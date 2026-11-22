import React, { useRef } from 'react';
import { NEUTRAL_PRESETS, PresetId } from '../../data/neutralPresets';
import { TRANSLATIONS } from '../../data/translations';
import {
  HeadDisplayMode,
  useAtelierStore,
} from '../../store/useAtelierStore';
import {
  IconAnimeSparkle,
  IconAtelierBrand,
  IconExportJson,
  IconFaceSculpt,
  IconFitVerify,
  IconGenderFemale,
  IconGenderMale,
  IconGlassSliders,
  IconImportJson,
  IconReset,
} from '../icons/CustomIcons';

export const GlassHeader: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const gender = useAtelierStore((s) => s.gender);
  const activePresetId = useAtelierStore((s) => s.activePresetId);
  const measurements = useAtelierStore((s) => s.measurements);
  const appearance = useAtelierStore((s) => s.appearance);
  const updateAppearance = useAtelierStore((s) => s.updateAppearance);
  const casPanelOpen = useAtelierStore((s) => s.casPanelOpen);
  const garmentInputsCm = useAtelierStore((s) => s.garmentInputsCm);
  const isFlatMode = useAtelierStore((s) => s.isFlatMode);
  const unit = useAtelierStore((s) => s.unit);
  const language = useAtelierStore((s) => s.language);
  const fitPanelOpen = useAtelierStore((s) => s.fitPanelOpen);
  const customizerOpen = useAtelierStore((s) => s.customizerOpen);
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
  const importProfileData = useAtelierStore((s) => s.importProfileData);

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
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atelierform3d-${gender}-${activePresetId}.json`;
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

  return (
    <header
      id="atelier-glass-header"
      className="fixed top-3 left-3 right-3 z-30 liquid-glass rounded-2xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2"
    >
      {/* Brand Title & Subtitle */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/20 shadow-inner"
          style={{
            background: 'rgba(var(--accent-rgb), 0.18)',
            color: 'var(--accent-primary)',
          }}
        >
          <IconAtelierBrand size={20} />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight leading-tight">
            {t.appTitle}
          </h1>
          <p className="text-[11px] opacity-70 hidden xl:block leading-tight">
            {t.appSubtitle}
          </p>
        </div>
      </div>

      {/* Center Controls: Gender Switcher, Preset Selector, Head Mode & Background Color */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Gender Segmented Switcher */}
        <div
          className="flex items-center p-0.5 rounded-xl border border-white/10"
          style={{ background: 'var(--glass-bg-elevated)' }}
        >
          <button
            id="gender-female-btn"
            type="button"
            onClick={() => setGender('female')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
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
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              gender === 'male'
                ? 'liquid-glass-pill-active'
                : 'opacity-75 hover:opacity-100'
            }`}
          >
            <IconGenderMale size={14} />
            <span>{t.gender.male}</span>
          </button>
        </div>

        {/* Neutral Body Preset Selector */}
        <div className="flex items-center gap-1.5">
          <select
            id="preset-selector"
            aria-label={t.presets.label}
            value={activePresetId}
            onChange={(e) => {
              const val = e.target.value;
              if (val !== 'custom') {
                selectPreset(val as PresetId);
              }
            }}
            className="liquid-glass-pill rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none cursor-pointer bg-transparent"
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
          </select>

          <button
            id="reset-preset-btn"
            type="button"
            onClick={resetCurrentPreset}
            title={t.header.resetPreset}
            className="liquid-glass-pill p-1.5 rounded-xl opacity-80 hover:opacity-100"
          >
            <IconReset size={15} />
          </button>
        </div>

        {/* Head Display Mode Switcher (Bald Mannequin / Headless Neck Cut / Full Anime with Hair) */}
        <button
          id="cycle-head-mode-btn"
          type="button"
          onClick={cycleHeadMode}
          title={t.header.headModeTooltip}
          className="liquid-glass-pill px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-medium"
        >
          <IconFaceSculpt size={15} />
          <span className="hidden md:inline">
            {t.cas.headModes[appearance.headDisplayMode]}
          </span>
        </button>

        {/* Direct Custom Background Color Picker in Top Bar */}
        <label
          title={t.header.bgColorTooltip}
          className="liquid-glass-pill px-2 py-1 rounded-xl flex items-center gap-1.5 cursor-pointer text-xs"
        >
          <input
            id="header-bg-color-picker"
            type="color"
            aria-label={t.header.bgColorTooltip}
            value={canvasBgColor}
            onChange={(e) =>
              updateGlassSettings({ canvasBgColor: e.target.value })
            }
            className="w-5 h-5 rounded-md cursor-pointer border border-white/25 bg-transparent"
          />
          <span className="font-mono text-[11px] uppercase hidden lg:inline opacity-80">
            {canvasBgColor}
          </span>
        </label>
      </div>

      {/* Right Controls: Anime CAS Studio, Fit Check, Unit, Language, Import/Export, Customizer */}
      <div className="flex items-center gap-1.5">
        {/* Anime CAS Studio Trigger */}
        <button
          id="toggle-cas-panel-btn"
          type="button"
          onClick={() => setCasPanelOpen(!casPanelOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            casPanelOpen ? 'liquid-glass-pill-active' : 'liquid-glass-pill'
          }`}
        >
          <IconAnimeSparkle size={15} />
          <span className="hidden md:inline">{t.header.casStudio}</span>
        </button>

        {/* Garment Fit Check Panel Trigger */}
        <button
          id="toggle-fit-panel-btn"
          type="button"
          onClick={() => setFitPanelOpen(!fitPanelOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            fitPanelOpen ? 'liquid-glass-pill-active' : 'liquid-glass-pill'
          }`}
        >
          <IconFitVerify size={15} />
          <span className="hidden lg:inline">{t.header.fitCheck}</span>
          {activeGarmentCount > 0 && (
            <span
              className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold tabular-nums"
              style={{
                background: 'var(--accent-primary)',
                color: '#0f172a',
              }}
            >
              {activeGarmentCount}
            </span>
          )}
        </button>

        {/* Unit Toggle (cm / in) */}
        <div
          className="flex items-center p-0.5 rounded-xl border border-white/10"
          style={{ background: 'var(--glass-bg-elevated)' }}
        >
          <button
            id="unit-cm-btn"
            type="button"
            onClick={() => setUnit('cm')}
            className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
              unit === 'cm'
                ? 'liquid-glass-pill-active'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            {t.units.cm}
          </button>
          <button
            id="unit-in-btn"
            type="button"
            onClick={() => setUnit('in')}
            className={`px-2 py-1 rounded-lg text-xs font-mono font-medium transition-all ${
              unit === 'in'
                ? 'liquid-glass-pill-active'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            {t.units.in}
          </button>
        </div>

        {/* Language Toggle (UA / EN) */}
        <div
          className="flex items-center p-0.5 rounded-xl border border-white/10"
          style={{ background: 'var(--glass-bg-elevated)' }}
        >
          <button
            id="lang-ua-btn"
            type="button"
            onClick={() => setLanguage('ua')}
            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
              language === 'ua'
                ? 'liquid-glass-pill-active'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            UA
          </button>
          <button
            id="lang-en-btn"
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
              language === 'en'
                ? 'liquid-glass-pill-active'
                : 'opacity-70 hover:opacity-100'
            }`}
          >
            EN
          </button>
        </div>

        {/* JSON Export / Import */}
        <button
          id="export-json-btn"
          type="button"
          onClick={handleExportJson}
          title={t.header.exportJson}
          className="liquid-glass-pill p-1.5 rounded-xl flex items-center gap-1 text-xs"
        >
          <IconExportJson size={15} />
        </button>

        <button
          id="import-json-btn"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title={t.header.importJson}
          className="liquid-glass-pill p-1.5 rounded-xl flex items-center gap-1 text-xs"
        >
          <IconImportJson size={15} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportJson}
          className="hidden"
        />

        {/* Glass & Surface Customizer Trigger */}
        <button
          id="toggle-glass-customizer-btn"
          type="button"
          onClick={() => setCustomizerOpen(!customizerOpen)}
          title={t.header.glassStyle}
          className={`p-1.5 rounded-xl transition-all ${
            customizerOpen ? 'liquid-glass-pill-active' : 'liquid-glass-pill'
          }`}
        >
          <IconGlassSliders size={16} />
        </button>
      </div>
    </header>
  );
};
