import React, { useEffect, useMemo, useRef } from 'react';
import {
  MEASUREMENT_CATEGORIES,
  MEASUREMENTS_SCHEMA,
  MeasurementCategory,
  MeasurementKey,
  MeasurementParameterMeta,
} from '../../data/measurementsSchema';
import { TRANSLATIONS } from '../../data/translations';
import {
  BLENDER_BODY_MEASURES,
  DEFAULT_BODY_MODEL,
  DisplayMode,
  useAtelierStore,
} from '../../store/useAtelierStore';
import { LINKED_MEASURE_MOVES, isLinkedMeasure } from '../../utils/linkedMeasures';
import { cmToUnit, unitToCm } from '../../utils/fitCalculator';
import {
  IconCategory,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconEyeClosed,
  IconEyeOpen,
  IconSearch,
} from '../icons/CustomIcons';

export const MeasurementsPanel: React.FC = () => {
  const rowRefs = useRef<Partial<Record<MeasurementKey, HTMLDivElement | null>>>({});

  const leftPanelOpen = useAtelierStore((s) => s.leftPanelOpen);
  const setLeftPanelOpen = useAtelierStore((s) => s.setLeftPanelOpen);
  const measurements = useAtelierStore((s) => s.measurements);
  const setMeasurement = useAtelierStore((s) => s.setMeasurement);
  const unit = useAtelierStore((s) => s.unit);
  const bodyModel = useAtelierStore(
    (s) => s.glassSettings.bodyModel ?? DEFAULT_BODY_MODEL
  );
  const language = useAtelierStore((s) => s.language);
  const displayMode = useAtelierStore((s) => s.displayMode);
  const setDisplayMode = useAtelierStore((s) => s.setDisplayMode);
  const activeCategories = useAtelierStore((s) => s.activeCategories);
  const toggleCategoryFilter = useAtelierStore((s) => s.toggleCategoryFilter);
  const hiddenMeasurements = useAtelierStore((s) => s.hiddenMeasurements);
  const toggleMeasurementVisibility = useAtelierStore(
    (s) => s.toggleMeasurementVisibility
  );
  const setAllMeasurementsVisibility = useAtelierStore(
    (s) => s.setAllMeasurementsVisibility
  );
  const selectedMeasurement = useAtelierStore((s) => s.selectedMeasurement);
  const hoveredMeasurement = useAtelierStore((s) => s.hoveredMeasurement);
  const setSelectedMeasurement = useAtelierStore((s) => s.setSelectedMeasurement);
  const setHoveredMeasurement = useAtelierStore((s) => s.setHoveredMeasurement);
  const searchQuery = useAtelierStore((s) => s.searchQuery);
  const setSearchQuery = useAtelierStore((s) => s.setSearchQuery);

  const t = TRANSLATIONS[language];

  // Auto-scroll to selected measurement when clicked in 3D canvas
  useEffect(() => {
    if (selectedMeasurement && rowRefs.current[selectedMeasurement]) {
      rowRefs.current[selectedMeasurement]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedMeasurement]);

  // Filter measurements by search query (matches UA name, EN name, or parameter code)
  const groupedParameters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const groups: Record<MeasurementCategory, MeasurementParameterMeta[]> = {
      circumferences: [],
      torso: [],
      sleeves: [],
      legs: [],
      heights: [],
      extremities: [],
    };

    for (const meta of MEASUREMENTS_SCHEMA) {
      if (q) {
        const uaName = TRANSLATIONS.ua.measurements[meta.key].name.toLowerCase();
        const enName = TRANSLATIONS.en.measurements[meta.key].name.toLowerCase();
        const code = meta.code.toLowerCase();
        const keyStr = meta.key.toLowerCase();
        if (
          !uaName.includes(q) &&
          !enName.includes(q) &&
          !code.includes(q) &&
          !keyStr.includes(q)
        ) {
          continue;
        }
      }
      groups[meta.category].push(meta);
    }

    return groups;
  }, [searchQuery]);

  const totalFilteredCount = useMemo(
    () =>
      Object.values(groupedParameters).reduce(
        (sum, list) => sum + list.length,
        0
      ),
    [groupedParameters]
  );

  if (!leftPanelOpen) {
    return (
      <button
        id="expand-measurements-panel-btn"
        type="button"
        onClick={() => setLeftPanelOpen(true)}
        title={t.inspector.expandPanel}
        aria-label={t.inspector.expandPanel}
        className="fixed left-3 top-[calc(var(--header-bottom,60px)+8px)] z-20 liquid-glass rounded-2xl px-3 py-2.5 flex items-center gap-2 text-xs font-medium hover:scale-[1.02] transition-all"
      >
        <IconChevronRight size={16} />
        <span>{t.inspector.stubLabel}</span>
      </button>
    );
  }

  const displayModes: Array<{ id: DisplayMode; label: string }> = [
    { id: 'all', label: t.inspector.modes.all },
    { id: 'category', label: t.inspector.modes.category },
    { id: 'active', label: t.inspector.modes.active },
  ];

  return (
    <aside
      id="measurements-inspector-panel"
      className="fixed left-3 top-[calc(var(--header-bottom,60px)+8px)] bottom-16 z-20 w-[335px] sm:w-[360px] max-w-[calc(100vw-24px)] liquid-glass rounded-2xl flex flex-col overflow-hidden mobile-drawer-panel"
    >
      {/* Panel Header */}
      <div className="px-3.5 pt-3 pb-2.5 border-b border-white/10 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider">
              {t.inspector.title}
            </h2>
            <span
              className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold tabular-nums"
              style={{
                background: 'rgba(var(--accent-rgb), 0.16)',
                color: 'var(--accent-primary)',
              }}
            >
              {totalFilteredCount} {t.inspector.parametersCount}
            </span>
          </div>
          <p className="text-[11px] opacity-65 mt-0.5">{t.inspector.subtitle}</p>
          <p className="text-[10px] opacity-55 mt-1 leading-snug">
            {t.inspector.linkedNote}
          </p>
        </div>

        <button
          id="collapse-measurements-panel-btn"
          type="button"
          onClick={() => setLeftPanelOpen(false)}
          title={t.inspector.collapsePanel}
          aria-label={t.inspector.collapsePanel}
          className="liquid-glass-pill p-1.5 rounded-xl opacity-75 hover:opacity-100"
        >
          <IconChevronLeft size={15} />
        </button>
      </div>

      {/* Display Mode Segmented Control & Category Multi-Select Pills */}
      <div className="px-3.5 py-2.5 border-b border-white/10 space-y-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider opacity-70 font-medium">
          <span>{t.inspector.displayModeLabel}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAllMeasurementsVisibility(true)}
              className="hover:underline"
            >
              {t.inspector.showAll}
            </button>
            <span>/</span>
            <button
              type="button"
              onClick={() => setAllMeasurementsVisibility(false)}
              className="hover:underline"
            >
              {t.inspector.hideAll}
            </button>
          </div>
        </div>

        {/* 3-Way Segmented Mode Control */}
        <div
          className="grid grid-cols-3 gap-1 p-0.5 rounded-xl border border-white/10"
          style={{ background: 'var(--glass-bg-elevated)' }}
        >
          {displayModes.map((m) => (
            <button
              key={m.id}
              id={`display-mode-${m.id}-btn`}
              type="button"
              onClick={() => setDisplayMode(m.id)}
              className={`py-1 px-1.5 rounded-lg text-[11px] font-medium truncate transition-all ${
                displayMode === m.id
                  ? 'liquid-glass-pill-active'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Category Multi-Select Filter Pills */}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {MEASUREMENT_CATEGORIES.map((cat) => {
            const isActive = activeCategories.includes(cat);
            return (
              <button
                key={cat}
                id={`category-pill-${cat}`}
                type="button"
                onClick={() => toggleCategoryFilter(cat)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  isActive && displayMode === 'category'
                    ? 'liquid-glass-pill-active'
                    : isActive
                    ? 'liquid-glass-pill opacity-90'
                    : 'liquid-glass-pill opacity-45'
                }`}
              >
                <IconCategory category={cat} size={12} />
                <span>{t.categories[cat]}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative pt-0.5">
          <IconSearch
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"
          />
          <input
            id="measurement-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.inspector.searchPlaceholder}
            className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs outline-none border border-white/10 focus:border-sky-400/60 transition-colors bg-black/15"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
            >
              <IconClose size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Parameter List across 6 Categories */}
      <div className="flex-1 overflow-y-auto glass-scroll px-3 py-2 space-y-3.5">
        {totalFilteredCount === 0 && (
          <div className="py-10 text-center text-xs opacity-60">
            {t.inspector.noResults}
          </div>
        )}

        {MEASUREMENT_CATEGORIES.map((category) => {
          const items = groupedParameters[category];
          if (!items || items.length === 0) return null;

          return (
            <section key={category} className="space-y-1.5">
              {/* Category Sticky Subheader */}
              <div className="flex items-center justify-between px-1 py-1 text-[11px] font-semibold uppercase tracking-wider opacity-80 border-b border-white/10">
                <div className="flex items-center gap-1.5">
                  <IconCategory category={category} size={14} />
                  <span>{t.categories[category]}</span>
                </div>
                <span className="font-mono text-[10px] opacity-65">
                  {items.length}
                </span>
              </div>

              {/* Parameter Rows */}
              <div className="space-y-1">
                {items.map((meta) => {
                  const key = meta.key;
                  const valCm = measurements[key];
                  const displayVal = cmToUnit(valCm, unit);
                  const minVal = cmToUnit(meta.min, unit);
                  const maxVal = cmToUnit(meta.max, unit);
                  const stepVal = unit === 'in' ? 0.25 : 0.5;

                  const isSelected = selectedMeasurement === key;
                  const isHovered = hoveredMeasurement === key;
                  const isHidden = Boolean(hiddenMeasurements[key]);
                  const loc = t.measurements[key];
                  // The Blender bodies follow only some measures so far; mark the rest.
                  const linked = isLinkedMeasure(key);
                  const notOnModel =
                    bodyModel !== 'classic' &&
                    !linked &&
                    !BLENDER_BODY_MEASURES.includes(key);
                  const linkedHint = linked
                    ? `${t.inspector.linkedMoves} ${(LINKED_MEASURE_MOVES[key] ?? [])
                        .map((k) => t.measurements[k].name)
                        .join(', ')}`
                    : '';

                  return (
                    <div
                      key={key}
                      ref={(el) => {
                        rowRefs.current[key] = el;
                      }}
                      onClick={() => setSelectedMeasurement(key)}
                      onMouseEnter={() => setHoveredMeasurement(key)}
                      onMouseLeave={() => setHoveredMeasurement(null)}
                      title={
                        notOnModel
                          ? `${loc.tooltip}\n\n${t.inspector.notOnModelHint}`
                          : loc.tooltip
                      }
                      data-on-model={notOnModel ? 'no' : 'yes'}
                      className={`group rounded-xl px-2.5 py-1.5 transition-all cursor-pointer border ${
                        notOnModel ? 'opacity-55 ' : ''
                      }${
                        isSelected
                          ? 'liquid-glass-pill-active'
                          : isHovered
                          ? 'border-white/25 bg-white/10'
                          : 'border-transparent hover:bg-white/5'
                      }`}
                    >
                      {/* Top line: Code, Label, Numeric Input, Unit, Eye Toggle */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-white/10 opacity-75 shrink-0">
                            {meta.code}
                          </span>
                          <span className="text-xs font-medium truncate">
                            {loc.name}
                          </span>
                          {linked && (
                            <span
                              title={linkedHint}
                              className="text-[9px] px-1 py-0.5 rounded border border-white/20 opacity-80 shrink-0 whitespace-nowrap"
                            >
                              {t.inspector.linkedTag}
                            </span>
                          )}
                          {notOnModel && (
                            <span className="text-[9px] px-1 py-0.5 rounded border border-white/25 opacity-90 shrink-0 whitespace-nowrap">
                              {t.inspector.notOnModel}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            aria-label={loc.name}
                            type="number"
                            step={stepVal}
                            min={minVal}
                            max={maxVal}
                            value={displayVal}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const parsed = parseFloat(e.target.value);
                              if (!Number.isNaN(parsed)) {
                                setMeasurement(key, unitToCm(parsed, unit));
                              }
                            }}
                            className="no-spinner w-14 text-right font-mono text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-lg bg-black/20 border border-white/15 focus:border-sky-400 outline-none"
                          />
                          <span className="text-[10px] font-mono opacity-60 w-4">
                            {unit}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMeasurementVisibility(key);
                            }}
                            className={`p-1 rounded-lg transition-opacity ${
                              isHidden
                                ? 'opacity-35 hover:opacity-80'
                                : 'opacity-80 hover:opacity-100'
                            }`}
                          >
                            {isHidden ? (
                              <IconEyeClosed size={13} />
                            ) : (
                              <IconEyeOpen size={13} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Bottom line: Range Slider */}
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="range"
                          min={meta.min}
                          max={meta.max}
                          step={meta.step}
                          value={valCm}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setMeasurement(key, parseFloat(e.target.value))
                          }
                          className="glass-slider"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
};
