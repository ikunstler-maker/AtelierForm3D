import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import {
  MEASUREMENTS_MAP,
  MEASUREMENTS_SCHEMA,
  MeasurementCategory,
  MeasurementKey,
} from '../../data/measurementsSchema';
import { TRANSLATIONS } from '../../data/translations';
import { useAtelierStore } from '../../store/useAtelierStore';
import {
  GARMENT_TEMPLATE_KEYS,
  evaluateParameterFit,
  formatDeltaWithUnit,
  formatValueWithUnit,
} from '../../utils/fitCalculator';
import {
  OverlayGeometryData,
  computeAllMeasurementOverlays,
} from '../../utils/geometryMath';

const CATEGORY_DEFAULT_COLORS: Record<MeasurementCategory, string> = {
  circumferences: '#38bdf8', // Sky cyan
  torso: '#a78bfa',          // Soft indigo
  sleeves: '#2dd4bf',        // Teal mint
  legs: '#f59e0b',           // Warm amber
  heights: '#94a3b8',        // Slate silver
  extremities: '#f472b6',    // Rose pink
};

interface SingleOverlayMeshProps {
  data: OverlayGeometryData;
  isSelected: boolean;
  isHovered: boolean;
  colorHex: string;
  opacity: number;
  tubeRadius: number;
  onSelect: (key: MeasurementKey) => void;
  onHover: (key: MeasurementKey | null) => void;
}

const SingleOverlayMesh: React.FC<SingleOverlayMeshProps> = React.memo(
  ({
    data,
    isSelected,
    isHovered,
    colorHex,
    opacity,
    tubeRadius,
    onSelect,
    onHover,
  }) => {
    const { tubeGeo, hitTubeGeo, startPt, endPt } = useMemo(() => {
      const curve = new THREE.CatmullRomCurve3(
        data.points,
        data.closed,
        'centripetal',
        0.25
      );
      const tabularSegments = Math.max(24, data.points.length * 2);
      const visibleTube = new THREE.TubeGeometry(
        curve,
        tabularSegments,
        tubeRadius,
        10,
        data.closed
      );
      // Slightly wider invisible hit-target tube for effortless mouse hover/click picking
      const hitTube = new THREE.TubeGeometry(
        curve,
        Math.max(16, data.points.length),
        Math.max(0.0085, tubeRadius * 3.2),
        6,
        data.closed
      );
      return {
        tubeGeo: visibleTube,
        hitTubeGeo: hitTube,
        startPt: data.points[0],
        endPt: data.points[data.points.length - 1],
      };
    }, [data, tubeRadius]);

    const activeHighlight = isSelected || isHovered;

    return (
      <group>
        {/* Visible 3D Tube Ring or Geodesic Line */}
        <mesh geometry={tubeGeo}>
          <meshStandardMaterial
            color={colorHex}
            emissive={colorHex}
            emissiveIntensity={activeHighlight ? 0.75 : 0.28}
            roughness={0.25}
            metalness={0.1}
            transparent={opacity < 0.99}
            opacity={opacity}
          />
        </mesh>

        {/* Invisible wider hit mesh for smooth pointer picking */}
        <mesh
          geometry={hitTubeGeo}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(data.key);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
            onHover(data.key);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'auto';
            onHover(null);
          }}
        >
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Spherical end-markers for non-closed linear/curved seam measurements */}
        {!data.closed && (
          <>
            <mesh position={startPt}>
              <sphereGeometry args={[tubeRadius * 2.1, 14, 14]} />
              <meshStandardMaterial
                color={colorHex}
                emissive={colorHex}
                emissiveIntensity={activeHighlight ? 0.85 : 0.35}
              />
            </mesh>
            <mesh position={endPt}>
              <sphereGeometry args={[tubeRadius * 2.1, 14, 14]} />
              <meshStandardMaterial
                color={colorHex}
                emissive={colorHex}
                emissiveIntensity={activeHighlight ? 0.85 : 0.35}
              />
            </mesh>
          </>
        )}
      </group>
    );
  }
);

export const MeasurementOverlays: React.FC = () => {
  const gender = useAtelierStore((s) => s.gender);
  const measurements = useAtelierStore((s) => s.measurements);
  const displayMode = useAtelierStore((s) => s.displayMode);
  const activeCategories = useAtelierStore((s) => s.activeCategories);
  const hiddenMeasurements = useAtelierStore((s) => s.hiddenMeasurements);
  const selectedMeasurement = useAtelierStore((s) => s.selectedMeasurement);
  const hoveredMeasurement = useAtelierStore((s) => s.hoveredMeasurement);
  const setSelectedMeasurement = useAtelierStore((s) => s.setSelectedMeasurement);
  const setHoveredMeasurement = useAtelierStore((s) => s.setHoveredMeasurement);
  const fitPanelOpen = useAtelierStore((s) => s.fitPanelOpen);
  const garmentTemplate = useAtelierStore((s) => s.garmentTemplate);
  const garmentInputsCm = useAtelierStore((s) => s.garmentInputsCm);
  const isFlatMode = useAtelierStore((s) => s.isFlatMode);
  const unit = useAtelierStore((s) => s.unit);
  const language = useAtelierStore((s) => s.language);
  const accentHex = useAtelierStore((s) => s.glassSettings.accentHex);

  const t = TRANSLATIONS[language];

  // Compute all 50 3D overlay curves in real time from current mannequin state
  const allOverlays = useMemo(
    () => computeAllMeasurementOverlays(measurements, gender),
    [measurements, gender]
  );

  // Determine which measurements are visible
  const visibleKeys = useMemo(() => {
    const templateSet = new Set(GARMENT_TEMPLATE_KEYS[garmentTemplate]);
    const activeTarget = hoveredMeasurement || selectedMeasurement;

    return MEASUREMENTS_SCHEMA.filter((meta) => {
      const key = meta.key;

      // Always show currently hovered or selected measurement
      if (key === hoveredMeasurement || key === selectedMeasurement) {
        return true;
      }

      // Respect individual eye visibility toggle
      if (hiddenMeasurements[key]) {
        return false;
      }

      // If Fit Check panel is open and template is not 'all', prioritize template keys
      if (fitPanelOpen && garmentTemplate !== 'all' && displayMode !== 'active') {
        return templateSet.has(key);
      }

      if (displayMode === 'active') {
        return key === activeTarget;
      }

      if (displayMode === 'category') {
        return activeCategories.includes(meta.category);
      }

      // 'all' mode: show all non-hidden parameters
      return true;
    }).map((m) => m.key);
  }, [
    displayMode,
    activeCategories,
    hiddenMeasurements,
    selectedMeasurement,
    hoveredMeasurement,
    fitPanelOpen,
    garmentTemplate,
  ]);

  // Evaluate fit status for all parameters
  const fitEvaluations = useMemo(() => {
    const map = {} as Record<MeasurementKey, ReturnType<typeof evaluateParameterFit>>;
    for (const meta of MEASUREMENTS_SCHEMA) {
      map[meta.key] = evaluateParameterFit(
        meta.key,
        measurements,
        garmentInputsCm,
        isFlatMode
      );
    }
    return map;
  }, [measurements, garmentInputsCm, isFlatMode]);

  const activeBadgeKey = hoveredMeasurement || selectedMeasurement;
  const activeBadgeOverlay = activeBadgeKey ? allOverlays[activeBadgeKey] : null;
  const activeBadgeMeta = activeBadgeKey ? MEASUREMENTS_MAP[activeBadgeKey] : null;
  const activeBadgeFit = activeBadgeKey ? fitEvaluations[activeBadgeKey] : null;

  return (
    <group name="measurement-overlays-layer">
      {visibleKeys.map((key) => {
        const data = allOverlays[key];
        const meta = MEASUREMENTS_MAP[key];
        if (!data || !meta) return null;

        const isSelected = key === selectedMeasurement;
        const isHovered = key === hoveredMeasurement;
        const isHighlighted = isSelected || isHovered;
        const fitEval = fitEvaluations[key];
        const hasFitValue = fitEval && fitEval.status !== 'unset';

        let colorHex =
          meta.category === 'circumferences'
            ? accentHex
            : CATEGORY_DEFAULT_COLORS[meta.category];

        if (hasFitValue) {
          colorHex = fitEval.colorHex;
        } else if (isHighlighted) {
          colorHex = '#ffffff';
        }

        const baseRadius =
          data.type === 'ring' ? 0.0021 : data.type === 'line' ? 0.0023 : 0.0015;
        const tubeRadius = isHighlighted
          ? baseRadius * 1.75
          : hasFitValue
          ? baseRadius * 1.35
          : baseRadius;

        const opacity = isHighlighted
          ? 1.0
          : hasFitValue
          ? 0.96
          : hoveredMeasurement && hoveredMeasurement !== key
          ? 0.35
          : 0.78;

        return (
          <SingleOverlayMesh
            key={key}
            data={data}
            isSelected={isSelected}
            isHovered={isHovered}
            colorHex={colorHex}
            opacity={opacity}
            tubeRadius={tubeRadius}
            onSelect={setSelectedMeasurement}
            onHover={setHoveredMeasurement}
          />
        );
      })}

      {/* Floating 3D Liquid Glass Readout Badge for Active/Hovered Measurement */}
      {activeBadgeKey && activeBadgeOverlay && activeBadgeMeta && (
        <Html
          position={activeBadgeOverlay.labelPosition}
          center
          distanceFactor={2.1}
          zIndexRange={[40, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="liquid-glass px-3 py-1.5 rounded-xl min-w-[165px] shadow-2xl border border-white/25 backdrop-blur-xl transition-all duration-150">
            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider font-mono opacity-75">
              <span>{activeBadgeMeta.code}</span>
              <span>{t.categories[activeBadgeMeta.category]}</span>
            </div>
            <div className="text-xs font-semibold leading-tight mt-0.5 whitespace-nowrap">
              {t.measurements[activeBadgeKey].name}
            </div>
            <div className="flex items-center justify-between gap-2.5 mt-1 pt-1 border-t border-white/15">
              <span className="font-mono text-xs font-bold tabular-nums text-sky-300">
                {formatValueWithUnit(measurements[activeBadgeKey], unit)}
              </span>
              {activeBadgeFit &&
                activeBadgeFit.status !== 'unset' &&
                activeBadgeFit.deltaCm !== null && (
                  <span
                    className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums"
                    style={{
                      backgroundColor: `${activeBadgeFit.colorHex}26`,
                      color: activeBadgeFit.colorHex,
                      border: `1px solid ${activeBadgeFit.colorHex}66`,
                    }}
                  >
                    {formatDeltaWithUnit(activeBadgeFit.deltaCm, unit)}
                  </span>
                )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
