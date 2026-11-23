import React from 'react';
import { MEASUREMENTS_MAP, MeasurementKey } from '../../data/measurementsSchema';
import { TRANSLATIONS } from '../../data/translations';
import { useAtelierStore } from '../../store/useAtelierStore';
import {
  FIT_STATUS_COLORS,
  FitStatus,
  GARMENT_TEMPLATE_KEYS,
  GarmentTemplateId,
  cmToUnit,
  evaluateParameterFit,
  formatDeltaWithUnit,
  formatValueWithUnit,
  unitToCm,
} from '../../utils/fitCalculator';
import { IconClose, IconFitVerify } from '../icons/CustomIcons';

export const FitCheckPanel: React.FC = () => {
  const fitPanelOpen = useAtelierStore((s) => s.fitPanelOpen);
  const setFitPanelOpen = useAtelierStore((s) => s.setFitPanelOpen);
  const garmentTemplate = useAtelierStore((s) => s.garmentTemplate);
  const setGarmentTemplate = useAtelierStore((s) => s.setGarmentTemplate);
  const isFlatMode = useAtelierStore((s) => s.isFlatMode);
  const setIsFlatMode = useAtelierStore((s) => s.setIsFlatMode);
  const garmentInputsCm = useAtelierStore((s) => s.garmentInputsCm);
  const setGarmentInput = useAtelierStore((s) => s.setGarmentInput);
  const clearGarmentInputs = useAtelierStore((s) => s.clearGarmentInputs);
  const loadSampleGarment = useAtelierStore((s) => s.loadSampleGarment);
  const measurements = useAtelierStore((s) => s.measurements);
  const unit = useAtelierStore((s) => s.unit);
  const language = useAtelierStore((s) => s.language);
  const selectedMeasurement = useAtelierStore((s) => s.selectedMeasurement);
  const setSelectedMeasurement = useAtelierStore((s) => s.setSelectedMeasurement);
  const setHoveredMeasurement = useAtelierStore((s) => s.setHoveredMeasurement);

  if (!fitPanelOpen) return null;

  const t = TRANSLATIONS[language];
  const templateKeys = GARMENT_TEMPLATE_KEYS[garmentTemplate];

  const templates: Array<{ id: GarmentTemplateId; label: string }> = [
    { id: 'top', label: t.fitPanel.templates.top },
    { id: 'jacket', label: t.fitPanel.templates.jacket },
    { id: 'trousers', label: t.fitPanel.templates.trousers },
    { id: 'dress', label: t.fitPanel.templates.dress },
    { id: 'all', label: t.fitPanel.templates.all },
  ];

  const legendStatuses: Array<Exclude<FitStatus, 'unset'>> = [
    'tight',
    'snug',
    'regular',
    'oversized',
  ];

  return (
    <aside
      id="garment-fit-check-panel"
      className="fixed right-3 top-[calc(var(--header-bottom,60px)+8px)] bottom-16 z-20 w-[355px] sm:w-[385px] max-w-[calc(100vw-24px)] liquid-glass rounded-2xl flex flex-col overflow-hidden mobile-drawer-panel"
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
            <IconFitVerify size={16} />
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider">
              {t.fitPanel.title}
            </h2>
            <p className="text-[11px] opacity-65">{t.fitPanel.subtitle}</p>
          </div>
        </div>

        <button
          id="close-fit-panel-btn"
          type="button"
          onClick={() => setFitPanelOpen(false)}
          title={t.common.close}
          aria-label={t.common.close}
          className="liquid-glass-pill p-1.5 rounded-xl opacity-75 hover:opacity-100"
        >
          <IconClose size={15} />
        </button>
      </div>

      {/* Controls: Garment Template Selector + Flat (x2) vs Full Girth Toggle */}
      <div className="px-3.5 py-2.5 border-b border-white/10 space-y-2.5">
        {/* Garment Template Select */}
        <div className="space-y-1">
          <label
            htmlFor="garment-template-select"
            className="block text-[10px] uppercase tracking-wider opacity-70 font-medium"
          >
            {t.fitPanel.templateLabel}
          </label>
          <select
            id="garment-template-select"
            value={garmentTemplate}
            onChange={(e) =>
              setGarmentTemplate(e.target.value as GarmentTemplateId)
            }
            className="w-full liquid-glass-pill rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none cursor-pointer bg-transparent"
          >
            {templates.map((tpl) => (
              <option
                key={tpl.id}
                value={tpl.id}
                className="bg-slate-900 text-white"
              >
                {tpl.label}
              </option>
            ))}
          </select>
        </div>

        {/* Flat Lay (x2 for girths) vs Full Girth (x1) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider opacity-70 font-medium">
            <span>{t.fitPanel.inputModeLabel}</span>
          </div>
          <div
            className="grid grid-cols-2 gap-1 p-0.5 rounded-xl border border-white/10"
            style={{ background: 'var(--glass-bg-elevated)' }}
          >
            <button
              id="fit-mode-flat-btn"
              type="button"
              onClick={() => setIsFlatMode(true)}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-medium truncate transition-all ${
                isFlatMode
                  ? 'liquid-glass-pill-active'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              {t.fitPanel.flatMode}
            </button>
            <button
              id="fit-mode-full-btn"
              type="button"
              onClick={() => setIsFlatMode(false)}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-medium truncate transition-all ${
                !isFlatMode
                  ? 'liquid-glass-pill-active'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              {t.fitPanel.fullGirthMode}
            </button>
          </div>
        </div>

        {/* Sample Fill & Clear Action Buttons */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            id="load-sample-garment-btn"
            type="button"
            onClick={loadSampleGarment}
            className="flex-1 liquid-glass-pill-active py-1.5 px-2.5 rounded-xl text-xs font-medium text-center"
          >
            {t.fitPanel.loadSampleSize}
          </button>
          <button
            id="clear-garment-inputs-btn"
            type="button"
            onClick={clearGarmentInputs}
            className="liquid-glass-pill py-1.5 px-3 rounded-xl text-xs font-medium opacity-80 hover:opacity-100"
          >
            {t.fitPanel.clearAll}
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="px-4 py-1.5 border-b border-white/10 grid grid-cols-12 text-[10px] uppercase tracking-wider font-mono opacity-65">
        <span className="col-span-5">{t.presets.label}</span>
        <span className="col-span-2 text-right">{t.fitPanel.bodyColumn}</span>
        <span className="col-span-2 text-right">{t.fitPanel.garmentColumn}</span>
        <span className="col-span-3 text-right">{t.fitPanel.deltaColumn}</span>
      </div>

      {/* Garment Comparison Rows */}
      <div className="flex-1 overflow-y-auto glass-scroll px-3 py-2 space-y-1">
        {templateKeys.map((key: MeasurementKey) => {
          const meta = MEASUREMENTS_MAP[key];
          if (!meta) return null;

          const fit = evaluateParameterFit(
            key,
            measurements,
            garmentInputsCm,
            isFlatMode
          );

          const rawInputDisplay =
            fit.rawInputValue !== null ? cmToUnit(fit.rawInputValue, unit) : '';
          const isSelected = selectedMeasurement === key;
          const loc = t.measurements[key];

          return (
            <div
              key={key}
              onClick={() => setSelectedMeasurement(key)}
              onMouseEnter={() => setHoveredMeasurement(key)}
              onMouseLeave={() => setHoveredMeasurement(null)}
              className={`rounded-xl px-2.5 py-1.5 grid grid-cols-12 items-center gap-1.5 transition-all cursor-pointer border ${
                isSelected
                  ? 'liquid-glass-pill-active'
                  : 'border-transparent hover:bg-white/5'
              }`}
            >
              {/* Parameter Name & Flat x2 Indicator */}
              <div className="col-span-5 min-w-0">
                <div className="flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor:
                        fit.status !== 'unset'
                          ? fit.colorHex
                          : 'rgba(148, 163, 184, 0.35)',
                    }}
                  />
                  <span className="text-xs font-medium truncate" title={loc.name}>
                    {loc.name}
                  </span>
                </div>
                {fit.isMultipliedFlat && (
                  <div className="text-[10px] font-mono opacity-65 pl-3">
                    {t.fitPanel.flatBadge}
                    {fit.effectiveGarmentCm !== null
                      ? ` = ${formatValueWithUnit(fit.effectiveGarmentCm, unit)}`
                      : ''}
                  </div>
                )}
              </div>

              {/* Body Value */}
              <div className="col-span-2 text-right font-mono text-xs tabular-nums opacity-75">
                {cmToUnit(fit.bodyCm, unit)}
              </div>

              {/* Garment Size-Chart Input */}
              <div className="col-span-2 flex justify-end">
                <input
                  aria-label={`${loc.name} garment input`}
                  type="number"
                  step={unit === 'in' ? 0.25 : 0.5}
                  placeholder="—"
                  value={rawInputDisplay}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const rawStr = e.target.value;
                    if (!rawStr.trim()) {
                      setGarmentInput(key, null);
                      return;
                    }
                    const parsed = parseFloat(rawStr);
                    if (!Number.isNaN(parsed)) {
                      setGarmentInput(key, unitToCm(parsed, unit));
                    }
                  }}
                  className="no-spinner w-14 text-right font-mono text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-lg bg-black/25 border border-white/15 focus:border-sky-400 outline-none"
                />
              </div>

              {/* Real-Time Delta & Status Badge */}
              <div className="col-span-3 flex flex-col items-end">
                {fit.status !== 'unset' && fit.deltaCm !== null ? (
                  <>
                    <span
                      className="font-mono text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${fit.colorHex}24`,
                        color: fit.colorHex,
                        border: `1px solid ${fit.colorHex}55`,
                      }}
                    >
                      {formatDeltaWithUnit(fit.deltaCm, unit)}
                    </span>
                    <span
                      className="text-[9px] font-medium truncate mt-0.5"
                      style={{ color: fit.colorHex }}
                    >
                      {t.fitPanel.statuses[fit.status]}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] font-mono opacity-40">
                    {t.fitPanel.statuses.unset}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fit Color Legend Footer */}
      <div className="px-3.5 py-2.5 border-t border-white/10 bg-black/15 space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">
          {t.fitPanel.legendTitle}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {legendStatuses.map((status) => (
            <div
              key={status}
              className="flex items-start gap-1.5 p-1.5 rounded-lg bg-white/5 border border-white/5"
            >
              <span
                className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0"
                style={{ backgroundColor: FIT_STATUS_COLORS[status] }}
              />
              <div className="min-w-0">
                <div
                  className="text-[11px] font-semibold leading-tight truncate"
                  style={{ color: FIT_STATUS_COLORS[status] }}
                >
                  {t.fitPanel.statuses[status]}
                </div>
                <div className="text-[10px] opacity-65 font-mono leading-tight mt-0.5 truncate">
                  {t.fitPanel.statusDescriptions[status]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
