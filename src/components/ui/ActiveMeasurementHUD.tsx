import React from 'react';
import { MEASUREMENTS_MAP } from '../../data/measurementsSchema';
import { TRANSLATIONS } from '../../data/translations';
import { useAtelierStore } from '../../store/useAtelierStore';
import {
  evaluateParameterFit,
  formatDeltaWithUnit,
  formatValueWithUnit,
} from '../../utils/fitCalculator';
import { IconClose, IconEyeClosed, IconEyeOpen } from '../icons/CustomIcons';

export const ActiveMeasurementHUD: React.FC = () => {
  const selectedMeasurement = useAtelierStore((s) => s.selectedMeasurement);
  const hoveredMeasurement = useAtelierStore((s) => s.hoveredMeasurement);
  const setSelectedMeasurement = useAtelierStore((s) => s.setSelectedMeasurement);
  const measurements = useAtelierStore((s) => s.measurements);
  const hiddenMeasurements = useAtelierStore((s) => s.hiddenMeasurements);
  const toggleMeasurementVisibility = useAtelierStore(
    (s) => s.toggleMeasurementVisibility
  );
  const garmentInputsCm = useAtelierStore((s) => s.garmentInputsCm);
  const isFlatMode = useAtelierStore((s) => s.isFlatMode);
  const unit = useAtelierStore((s) => s.unit);
  const language = useAtelierStore((s) => s.language);

  const activeKey = hoveredMeasurement || selectedMeasurement;
  if (!activeKey) return null;

  const meta = MEASUREMENTS_MAP[activeKey];
  if (!meta) return null;

  const t = TRANSLATIONS[language];
  const fitEval = evaluateParameterFit(
    activeKey,
    measurements,
    garmentInputsCm,
    isFlatMode
  );
  const isHidden = Boolean(hiddenMeasurements[activeKey]);

  return (
    <div
      id="active-measurement-docked-hud"
      className="fixed top-[68px] left-1/2 -translate-x-1/2 z-20 liquid-glass rounded-2xl px-3.5 py-1.5 flex items-center gap-3 shadow-xl max-w-[calc(100vw-24px)]"
    >
      {/* Code & Category */}
      <div className="flex items-center gap-1.5">
        <span
          className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md"
          style={{
            background: 'rgba(var(--accent-rgb), 0.18)',
            color: 'var(--accent-primary)',
          }}
        >
          {meta.code}
        </span>
        <span className="text-[11px] opacity-65 hidden sm:inline">
          {t.categories[meta.category]}
        </span>
      </div>

      <div className="h-3.5 w-[1px] bg-white/15" />

      {/* Parameter Name */}
      <span className="text-xs font-semibold truncate max-w-[200px] sm:max-w-[260px]">
        {t.measurements[activeKey].name}
      </span>

      {/* Body Value */}
      <span className="font-mono text-xs font-bold tabular-nums text-sky-300 whitespace-nowrap">
        {formatValueWithUnit(measurements[activeKey], unit)}
      </span>

      {/* Optional Fit Delta Badge */}
      {fitEval.status !== 'unset' && fitEval.deltaCm !== null && (
        <span
          className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums whitespace-nowrap"
          style={{
            backgroundColor: `${fitEval.colorHex}26`,
            color: fitEval.colorHex,
            border: `1px solid ${fitEval.colorHex}66`,
          }}
        >
          {formatDeltaWithUnit(fitEval.deltaCm, unit)}
        </span>
      )}

      {/* Visibility & Dismiss Controls */}
      <div className="flex items-center gap-1 pl-1 border-l border-white/15">
        <button
          type="button"
          onClick={() => toggleMeasurementVisibility(activeKey)}
          className="p-1 rounded-lg opacity-75 hover:opacity-100"
          title={t.inspector.hideAll}
        >
          {isHidden ? <IconEyeClosed size={13} /> : <IconEyeOpen size={13} />}
        </button>
        <button
          type="button"
          onClick={() => setSelectedMeasurement(null)}
          className="p-1 rounded-lg opacity-65 hover:opacity-100"
          title="Close"
        >
          <IconClose size={13} />
        </button>
      </div>
    </div>
  );
};
