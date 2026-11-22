import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useAtelierStore } from '../../store/useAtelierStore';
import {
  CM_TO_M,
  computeAnatomicalLandmarks,
  createLimbEvaluators,
  createTorsoEvaluator,
} from '../../utils/geometryMath';

/**
 * Builds a high-definition closed-ring lofted BufferGeometry from an ordered stack of cross-sectional rings.
 */
function buildLoftedGeometry(
  rings: THREE.Vector3[][],
  capBottom = true,
  capTop = true
): THREE.BufferGeometry {
  const numRings = rings.length;
  const radialSegments = rings[0].length;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < numRings; r++) {
    const ring = rings[r];
    for (let s = 0; s < radialSegments; s++) {
      const pt = ring[s];
      positions.push(pt.x, pt.y, pt.z);
    }
  }

  for (let r = 0; r < numRings - 1; r++) {
    const row1 = r * radialSegments;
    const row2 = (r + 1) * radialSegments;
    for (let s = 0; s < radialSegments; s++) {
      const nextS = (s + 1) % radialSegments;
      const a = row1 + s;
      const b = row1 + nextS;
      const c = row2 + s;
      const d = row2 + nextS;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  if (capBottom && numRings > 0) {
    const bottomCenter = new THREE.Vector3();
    rings[0].forEach((p) => bottomCenter.add(p));
    bottomCenter.divideScalar(radialSegments);
    const centerIdx = positions.length / 3;
    positions.push(bottomCenter.x, bottomCenter.y, bottomCenter.z);
    for (let s = 0; s < radialSegments; s++) {
      const nextS = (s + 1) % radialSegments;
      indices.push(centerIdx, nextS, s);
    }
  }

  if (capTop && numRings > 0) {
    const topRingIdx = (numRings - 1) * radialSegments;
    const topCenter = new THREE.Vector3();
    rings[numRings - 1].forEach((p) => topCenter.add(p));
    topCenter.divideScalar(radialSegments);
    const centerIdx = positions.length / 3;
    positions.push(topCenter.x, topCenter.y, topCenter.z);
    for (let s = 0; s < radialSegments; s++) {
      const nextS = (s + 1) % radialSegments;
      indices.push(topRingIdx + s, topRingIdx + nextS, centerIdx);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Builds an anatomical lofted human foot mesh from ankle down to floor (Y = 0)
 * featuring calcaneus heel contour, medial longitudinal arch, sloped dorsal instep,
 * metatarsal ball breadth, and asymmetric hallux-to-fifth-toe taper.
 */
function buildFootGeometry(
  side: 'left' | 'right',
  ankleCenter: THREE.Vector3,
  footLengthM: number,
  footWidthM: number,
  ankleRadiusA: number,
  ankleRadiusB: number
): THREE.BufferGeometry {
  const sign = side === 'left' ? 1 : -1;
  const heelZ = ankleCenter.z - footLengthM * 0.25;
  const archZ = ankleCenter.z + footLengthM * 0.22;
  const ballZ = ankleCenter.z + footLengthM * 0.54;
  const toeZ = ankleCenter.z + footLengthM * 0.75;

  const halfW = footWidthM * 0.5;
  const radialSegments = 40;

  const slices = [
    {
      y: 0.0015,
      zMin: heelZ + 0.008,
      zMax: toeZ - 0.005,
      halfWidth: halfW * 0.9,
      xOffset: sign * 0.004,
      archCarve: 0.22,
    },
    {
      y: 0.009,
      zMin: heelZ + 0.002,
      zMax: toeZ,
      halfWidth: halfW * 0.99,
      xOffset: sign * 0.004,
      archCarve: 0.26,
    },
    {
      y: 0.019,
      zMin: heelZ,
      zMax: toeZ - 0.003,
      halfWidth: halfW,
      xOffset: sign * 0.0035,
      archCarve: 0.24,
    },
    {
      y: 0.032,
      zMin: heelZ + 0.004,
      zMax: ballZ + (toeZ - ballZ) * 0.42,
      halfWidth: halfW * 0.85,
      xOffset: sign * 0.002,
      archCarve: 0.16,
    },
    {
      y: ankleCenter.y * 0.62,
      zMin: ankleCenter.z - ankleRadiusB * 1.25,
      zMax: archZ + 0.035,
      halfWidth: ankleRadiusA * 1.1,
      xOffset: sign * 0.001,
      archCarve: 0.06,
    },
    {
      y: ankleCenter.y * 0.85,
      zMin: ankleCenter.z - ankleRadiusB * 1.08,
      zMax: ankleCenter.z + ankleRadiusB * 1.16,
      halfWidth: ankleRadiusA * 1.02,
      xOffset: 0,
      archCarve: 0.0,
    },
    {
      y: ankleCenter.y + 0.004,
      zMin: ankleCenter.z - ankleRadiusB * 0.96,
      zMax: ankleCenter.z + ankleRadiusB * 0.96,
      halfWidth: ankleRadiusA * 0.96,
      xOffset: 0,
      archCarve: 0.0,
    },
  ];

  const rings: THREE.Vector3[][] = slices.map((slice) => {
    const zCenter = (slice.zMin + slice.zMax) * 0.5;
    const zHalf = (slice.zMax - slice.zMin) * 0.5;
    const pts: THREE.Vector3[] = [];

    for (let s = 0; s < radialSegments; s++) {
      const theta = (s / radialSegments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Asymmetric foot contour: narrower rounded heel (sinT < 0), wider ball (sinT > 0.2),
      // medial longitudinal arch indentation, and big-toe hallux bias on inner side
      const isOuterSide = sign * cosT > 0;
      let widthScale = 1.0;

      if (sinT < -0.2) {
        // Calcaneus heel is narrower than forefoot
        widthScale = 0.72 + 0.22 * (1 + sinT);
      } else if (sinT > 0.65) {
        // Asymmetric toe box taper (longer toward medial big toe)
        const medialToeBias = isOuterSide ? -0.14 * Math.pow(sinT - 0.65, 1.5) : 0.06;
        widthScale = 0.94 + medialToeBias;
      } else if (!isOuterSide && Math.abs(sinT) < 0.35) {
        // Medial arch carve on inner midfoot
        widthScale = 1.0 - slice.archCarve * (1 - Math.abs(sinT) / 0.35);
      }

      const x =
        ankleCenter.x + slice.xOffset + cosT * slice.halfWidth * widthScale;
      const z = zCenter + sinT * zHalf;
      pts.push(new THREE.Vector3(x, slice.y, z));
    }
    return pts;
  });

  return buildLoftedGeometry(rings, true, true);
}

export const ParametricBody: React.FC = () => {
  const gender = useAtelierStore((s) => s.gender);
  const measurements = useAtelierStore((s) => s.measurements);
  const surfaceFinish = useAtelierStore((s) => s.glassSettings.surfaceFinish);
  const theme = useAtelierStore((s) => s.glassSettings.theme);

  const {
    torsoGeometry,
    leftArmGeometry,
    rightArmGeometry,
    leftLegGeometry,
    rightLegGeometry,
    leftFootGeometry,
    rightFootGeometry,
  } = useMemo(() => {
    const L = computeAnatomicalLandmarks(measurements, gender);
    const torsoEval = createTorsoEvaluator(measurements, gender, L);
    const limbEval = createLimbEvaluators(measurements, gender, L);

    // 1. 110-Ring High-Resolution Lofted Torso, Pelvis, Trapezius, Neck & Head
    const TORSO_RINGS = 110;
    const TORSO_SEGMENTS = 72;
    const torsoRings: THREE.Vector3[][] = [];
    for (let i = 0; i < TORSO_RINGS; i++) {
      const u = i / (TORSO_RINGS - 1);
      const y = THREE.MathUtils.lerp(L.yCrotch, L.yCrown, u);
      const ring = torsoEval.sampleClosedRing(y, TORSO_SEGMENTS, 0);
      torsoRings.push(ring);
    }
    const torsoGeo = buildLoftedGeometry(torsoRings, true, true);

    // 2. 48-Ring Multi-Segment Lofted Arms + Hands (seamlessly rooted inside deltoid/shoulder)
    const ARM_RINGS = 48;
    const ARM_SEGMENTS = 44;
    const leftArmRings: THREE.Vector3[][] = [];
    const rightArmRings: THREE.Vector3[][] = [];

    for (let i = 0; i < ARM_RINGS; i++) {
      const t = i / (ARM_RINGS - 1);
      leftArmRings.push(limbEval.sampleArmRing('left', t, ARM_SEGMENTS, 0));
      const rightRing = limbEval
        .sampleArmRing('right', t, ARM_SEGMENTS, 0)
        .reverse();
      rightArmRings.push(rightRing);
    }

    const leftArmGeo = buildLoftedGeometry(leftArmRings, true, true);
    const rightArmGeo = buildLoftedGeometry(rightArmRings, true, true);

    // 3. 52-Ring Multi-Segment Lofted Legs (originating inside pelvis at yHip for seamless hip-to-thigh contour)
    const LEG_RINGS = 52;
    const LEG_SEGMENTS = 48;
    const leftLegRings: THREE.Vector3[][] = [];
    const rightLegRings: THREE.Vector3[][] = [];

    for (let i = 0; i < LEG_RINGS; i++) {
      const t = i / (LEG_RINGS - 1);
      leftLegRings.push(limbEval.sampleLegRing('left', t, LEG_SEGMENTS, 0));
      const rightRing = limbEval
        .sampleLegRing('right', t, LEG_SEGMENTS, 0)
        .reverse();
      rightLegRings.push(rightRing);
    }

    const leftLegGeo = buildLoftedGeometry(leftLegRings, true, true);
    const rightLegGeo = buildLoftedGeometry(rightLegRings, true, true);

    // 4. Sculpted Anatomical Feet driven by footLength and footWidth
    const footLenM = measurements.footLength * CM_TO_M;
    const footWidthM = measurements.footWidth * CM_TO_M;
    const ankleRad = (measurements.ankle * CM_TO_M) / (2 * Math.PI);

    const leftFootGeo = buildFootGeometry(
      'left',
      L.legAnkleL,
      footLenM,
      footWidthM,
      ankleRad * 0.94,
      ankleRad * 1.06
    );
    const rightAnkleCenter = new THREE.Vector3(
      -L.legAnkleL.x,
      L.legAnkleL.y,
      L.legAnkleL.z
    );
    const rightFootGeo = buildFootGeometry(
      'right',
      rightAnkleCenter,
      footLenM,
      footWidthM,
      ankleRad * 0.94,
      ankleRad * 1.06
    );

    return {
      torsoGeometry: torsoGeo,
      leftArmGeometry: leftArmGeo,
      rightArmGeometry: rightArmGeo,
      leftLegGeometry: leftLegGeo,
      rightLegGeometry: rightLegGeo,
      leftFootGeometry: leftFootGeo,
      rightFootGeometry: rightFootGeo,
    };
  }, [measurements, gender]);

  // Configure material properties for the 3 selectable surface shaders
  const materialProps = useMemo(() => {
    const isLight = theme === 'light';
    if (surfaceFinish === 'clay') {
      return {
        color: isLight ? '#d8dee8' : '#c8d0dc',
        roughness: 0.84,
        metalness: 0.02,
        clearcoat: 0.04,
        sheen: 0.25,
        sheenRoughness: 0.8,
        transparent: false,
        opacity: 1.0,
        depthWrite: true,
      };
    }
    if (surfaceFinish === 'translucent') {
      return {
        color: isLight ? '#94a3b8' : '#cbd5e1',
        roughness: 0.22,
        metalness: 0.08,
        clearcoat: 0.5,
        clearcoatRoughness: 0.2,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
      };
    }
    // Default: 'satin' (Satin Resin)
    return {
      color: isLight ? '#cfd6e2' : '#bcc6d6',
      roughness: 0.32,
      metalness: 0.08,
      clearcoat: 0.44,
      clearcoatRoughness: 0.24,
      sheen: 0.18,
      sheenRoughness: 0.5,
      transparent: false,
      opacity: 1.0,
      depthWrite: true,
    };
  }, [surfaceFinish, theme]);

  const sharedMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        ...materialProps,
        side: THREE.DoubleSide,
      }),
    [materialProps]
  );

  return (
    <group name="parametric-mannequin-group">
      {/* 110-Ring Lofted Torso, Pelvis, Trapezius, Neck & Head */}
      <mesh
        geometry={torsoGeometry}
        material={sharedMaterial}
        castShadow
        receiveShadow
      />

      {/* Left & Right Multi-Segment Lofted Arms & Hands */}
      <mesh
        geometry={leftArmGeometry}
        material={sharedMaterial}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={rightArmGeometry}
        material={sharedMaterial}
        castShadow
        receiveShadow
      />

      {/* Left & Right Multi-Segment Lofted Legs */}
      <mesh
        geometry={leftLegGeometry}
        material={sharedMaterial}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={rightLegGeometry}
        material={sharedMaterial}
        castShadow
        receiveShadow
      />

      {/* Left & Right Sculpted Feet */}
      <mesh
        geometry={leftFootGeometry}
        material={sharedMaterial}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={rightFootGeometry}
        material={sharedMaterial}
        castShadow
        receiveShadow
      />
    </group>
  );
};
