import React, { useMemo } from 'react';
import * as THREE from 'three';
import {
  MEASUREMENTS_MAP,
  MEASUREMENTS_SCHEMA,
  MeasurementCategory,
  MeasurementKey,
} from '../../data/measurementsSchema';
import { useAtelierStore } from '../../store/useAtelierStore';
import {
  GARMENT_TEMPLATE_KEYS,
  evaluateParameterFit,
} from '../../utils/fitCalculator';
import {
  OverlayGeometryData,
  computeAllMeasurementOverlays,
} from '../../utils/geometryMath';

const CATEGORY_DEFAULT_COLORS: Record<MeasurementCategory, string> = {
  circumferences: '#38bdf8',
  torso: '#a78bfa',
  sleeves: '#2dd4bf',
  legs: '#f59e0b',
  heights: '#94a3b8',
  extremities: '#f472b6',
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
  const accentHex = useAtelierStore((s) => s.glassSettings.accentHex);

  const allOverlays = useMemo(
    () => computeAllMeasurementOverlays(measurements, gender),
    [measurements, gender]
  );

  const visibleKeys = useMemo(() => {
    const templateSet = new Set(GARMENT_TEMPLATE_KEYS[garmentTemplate]);
    const activeTarget = hoveredMeasurement || selectedMeasurement;

    return MEASUREMENTS_SCHEMA.filter((meta) => {
      const key = meta.key;

      if (hiddenMeasurements[key]) {
        return false;
      }

      if (key === hoveredMeasurement || key === selectedMeasurement) {
        return true;
      }

      if (fitPanelOpen && garmentTemplate !== 'all' && displayMode !== 'active') {
        return templateSet.has(key);
      }

      if (displayMode === 'active') {
        return key === activeTarget;
      }

      if (displayMode === 'category') {
        return activeCategories.includes(meta.category);
      }

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
          colorHex = '#38bdf8';
        }

        const baseRadius =
          data.type === 'ring' ? 0.0018 : data.type === 'line' ? 0.002 : 0.0014;
        const tubeRadius = isHighlighted
          ? baseRadius * 1.55
          : hasFitValue
          ? baseRadius * 1.3
          : baseRadius;

        const opacity = isHighlighted
          ? 0.95
          : hasFitValue
          ? 0.92
          : hoveredMeasurement && hoveredMeasurement !== key
          ? 0.32
          : 0.72;

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
    </group>
  );
};
