import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useAtelierStore } from '../../store/useAtelierStore';
import {
  AnatomicalLandmarks,
  CM_TO_M,
  computeAnatomicalLandmarks,
  createLimbEvaluators,
  createTorsoEvaluator,
} from '../../utils/geometryMath';

/**
 * Builds a closed-ring lofted BufferGeometry from an ordered stack of cross-sectional rings.
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
 * Merges multiple BufferGeometries into a single BufferGeometry.
 */
function mergeBufferGeometries(
  geometries: THREE.BufferGeometry[]
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const geo of geometries) {
    const posAttr = geo.getAttribute('position');
    if (!posAttr) continue;

    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    }

    const indexAttr = geo.getIndex();
    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i++) {
        indices.push(indexAttr.getX(i) + vertexOffset);
      }
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        indices.push(i + vertexOffset);
      }
    }
    vertexOffset += posAttr.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Builds a Sims-4 CAS style sculpted head & face geometry (eyes, nose bridge & tip,
 * philtrum, upper/lower lips, chin, cheekbones, brow ridge, and sculpted ears)
 * parameterized by yJaw, yHeadMax, yCrown, headCircumference, and gender.
 */
function buildSculptedHeadAndFaceGeometry(
  L: AnatomicalLandmarks,
  headCircumferenceM: number,
  neckRadiusA: number,
  neckRadiusB: number,
  centerZNeck: number
): THREE.BufferGeometry {
  const isFemale = L.gender === 'female';
  // Head semi-axes from head circumference
  const headWidthA = (headCircumferenceM / (2 * Math.PI)) * 0.91;
  const headDepthB = (headCircumferenceM / (2 * Math.PI)) * 1.09;

  const yNeckTop = L.yJaw - 0.014;
  const headHeight = Math.max(0.18, L.yCrown - L.yJaw);
  const yChin = L.yJaw;
  const yLowerLip = L.yJaw + headHeight * 0.14;
  const yMouthCleft = L.yJaw + headHeight * 0.175;
  const yUpperLip = L.yJaw + headHeight * 0.21;
  const yNoseBase = L.yJaw + headHeight * 0.27;
  const yNoseTip = L.yJaw + headHeight * 0.31;
  const yEyeCenter = L.yJaw + headHeight * 0.45;
  const yBrowRidge = L.yJaw + headHeight * 0.54;

  const numRings = 56;
  const radialSegments = 72;
  const rings: THREE.Vector3[][] = [];

  const g1 = (v: number, c: number, s: number) =>
    Math.exp(-0.5 * Math.pow((v - c) / Math.max(1e-4, s), 2));

  for (let r = 0; r < numRings; r++) {
    const u = r / (numRings - 1);
    const y = THREE.MathUtils.lerp(yNeckTop, L.yCrown, u);

    // Normalized height inside cranium: 0 at yJaw -> 1 at yCrown
    const hNorm = Math.max(0, Math.min(1, (y - L.yJaw) / headHeight));

    // Base cranial envelope
    let a = headWidthA;
    let bF = headDepthB * 0.98;
    let bB = headDepthB * 1.04;
    let cZ = centerZNeck + 0.01;

    if (y < L.yJaw) {
      // Transition from upper neck to submental jaw
      const tNeck = (y - yNeckTop) / Math.max(0.005, L.yJaw - yNeckTop);
      a = THREE.MathUtils.lerp(neckRadiusA * 0.96, headWidthA * 0.72, tNeck);
      bF = THREE.MathUtils.lerp(neckRadiusB * 0.98, headDepthB * 0.85, tNeck);
      bB = THREE.MathUtils.lerp(neckRadiusB * 0.98, headDepthB * 0.82, tNeck);
    } else if (hNorm < 0.45) {
      // Lower face (chin up to cheekbones)
      const tFace = hNorm / 0.45;
      const jawTaper = isFemale ? 0.68 : 0.74;
      a = headWidthA * THREE.MathUtils.lerp(jawTaper, 0.98, Math.pow(tFace, 0.65));
      bF = headDepthB * THREE.MathUtils.lerp(0.86, 0.98, Math.pow(tFace, 0.55));
      bB = headDepthB * THREE.MathUtils.lerp(0.76, 1.02, Math.pow(tFace, 0.7));
    } else if (hNorm > 0.72) {
      // Upper cranial dome rounding to vertex crown
      const tDome = (hNorm - 0.72) / 0.28;
      const domeScale = Math.sqrt(Math.max(0.002, 1 - Math.pow(tDome, 1.85)));
      a = headWidthA * domeScale;
      bF = headDepthB * 0.96 * domeScale;
      bB = headDepthB * 1.04 * domeScale;
    }

    const ringPts: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegments; s++) {
      const theta = (s / radialSegments) * Math.PI * 2;
      const cosT = Math.cos(theta); // +1 = left ear, -1 = right ear
      const sinT = Math.sin(theta); // +1 = anterior face, -1 = posterior occiput
      const absCos = Math.abs(cosT);

      let x = a * cosT;
      let z = (sinT >= 0 ? bF : bB) * sinT;

      // Facial anatomical features on anterior half (sinT > 0)
      if (sinT > 0 && y >= L.yJaw - 0.005) {
        // 1. Mandible & Chin button (Sims-style clean jawline)
        const chinV = g1(y, yChin + 0.008, 0.012);
        const chinH = g1(absCos, 0, isFemale ? 0.24 : 0.3);
        const jawAngleH = g1(absCos, 0.72, 0.16);
        z += chinV * (isFemale ? 0.012 : 0.015) * chinH * Math.pow(sinT, 1.4);
        x +=
          Math.sign(cosT) *
          g1(y, yChin + 0.014, 0.014) *
          (isFemale ? 0.003 : 0.0065) *
          jawAngleH;

        // 2. Labiomental fold (crease between chin and lower lip)
        const mentalCrease = g1(y, (yChin + yLowerLip) * 0.52, 0.005);
        z -= mentalCrease * 0.0045 * g1(absCos, 0, 0.28) * Math.pow(sinT, 2);

        // 3. Lower Lip & Upper Lip (Cupid's bow & mouth corner pockets)
        const lowerLipV = g1(y, yLowerLip, 0.0055);
        const upperLipV = g1(y, yUpperLip, 0.0055);
        const mouthCleftV = g1(y, yMouthCleft, 0.0028);
        const lipSpanH = g1(absCos, 0, 0.23);
        const cupidsBow = 1.0 + 0.22 * g1(absCos, 0.08, 0.05) - 0.15 * g1(absCos, 0, 0.03);
        const mouthCornerDimple = g1(absCos, 0.28, 0.05) * g1(y, yMouthCleft, 0.008);

        z += lowerLipV * 0.0085 * lipSpanH * Math.pow(sinT, 2);
        z += upperLipV * 0.0095 * lipSpanH * cupidsBow * Math.pow(sinT, 2);
        z -= mouthCleftV * 0.0038 * lipSpanH * Math.pow(sinT, 2);
        z -= mouthCornerDimple * 0.0045;

        // 4. Nose (Nose bridge, dorsum, tip, nostrils/alae)
        const noseTipV = g1(y, yNoseTip, 0.009);
        const noseBridgeV =
          y >= yNoseTip && y <= yBrowRidge
            ? Math.sin(((y - yNoseTip) / (yBrowRidge - yNoseTip)) * Math.PI)
            : 0;
        const noseSubV = g1(y, yNoseBase, 0.006);

        const noseCenterH = g1(absCos, 0, 0.085);
        const nostrilFlareH = g1(absCos, 0.135, 0.048);

        z +=
          (noseTipV * 0.019 + noseBridgeV * 0.0135 + noseSubV * 0.008) *
          noseCenterH *
          Math.pow(sinT, 3);
        // Nostril wings
        z += noseTipV * 0.0075 * nostrilFlareH * Math.pow(sinT, 2);

        // 5. Eye Sockets (Orbital hollows) & Eyeball/Eyelid contour
        const orbitV = g1(y, yEyeCenter, 0.014);
        const orbitH = g1(absCos, 0.34, 0.13);
        const eyeballV = g1(y, yEyeCenter, 0.0075);
        const eyeballH = g1(absCos, 0.34, 0.08);
        // Orbital recess + rounded eyelid surface inside socket
        z -= orbitV * orbitH * 0.0095 * Math.pow(sinT, 1.5);
        z += eyeballV * eyeballH * 0.0055 * Math.pow(sinT, 1.6);

        // 6. Supraorbital Brow Ridge & Zygomatic Cheekbones
        const browV = g1(y, yBrowRidge, 0.011);
        const browH = g1(absCos, 0.32, 0.22);
        z +=
          browV *
          browH *
          (isFemale ? 0.0045 : 0.0075) *
          Math.pow(sinT, 1.5);

        const cheekV = g1(y, yNoseTip + 0.008, 0.018);
        const cheekH = g1(absCos, 0.58, 0.18);
        z += cheekV * cheekH * (isFemale ? 0.0065 : 0.005) * sinT;
        x +=
          Math.sign(cosT) *
          cheekV *
          cheekH *
          (isFemale ? 0.004 : 0.003);
      }

      // 7. Sculpted Ears (Pinna & Helix on lateral sides |cosT| -> 1, sinT ≈ -0.08)
      const earV = g1(y, (yNoseTip + yEyeCenter) * 0.52, 0.022);
      const earAngle = g1(sinT, -0.08, 0.11);
      if (earV > 0.02 && earAngle > 0.02) {
        const earProjection = earV * earAngle * 0.014;
        x += Math.sign(cosT) * earProjection;
        // Slight backward sweep of helix
        z -= earProjection * 0.35;
      }

      // 8. Occipital skull curve & nape indentation at back of head (sinT < 0)
      if (sinT < -0.2) {
        const napeHollow = g1(y, L.yJaw + 0.01, 0.022);
        const occiputFullness = g1(y, L.yHeadMax - 0.005, 0.045);
        z += napeHollow * 0.008 * Math.pow(-sinT, 1.8);
        z -= occiputFullness * 0.012 * Math.pow(-sinT, 1.4);
      }

      ringPts.push(new THREE.Vector3(x, y, z + cZ));
    }
    rings.push(ringPts);
  }

  return buildLoftedGeometry(rings, false, true);
}

/**
 * Builds an articulated 5-finger Sims-style hand geometry (palm, metacarpals,
 * opposable thumb, index, middle, ring, and pinky fingers) starting seamlessly
 * from the distal wrist ring.
 */
function buildSculptedHandGeometry(
  side: 'left' | 'right',
  wristCenterL: THREE.Vector3,
  handTipL: THREE.Vector3,
  handLengthM: number,
  handWidthM: number,
  wristAxesA: number,
  wristAxesB: number
): THREE.BufferGeometry {
  const sign = side === 'left' ? 1 : -1;

  // Compute local hand coordinate frame on left side (+X)
  const handAxisL = handTipL.clone().sub(wristCenterL).normalize();
  const forwardRef = new THREE.Vector3(0, 0, 1);
  // Outward dorsal/lateral vector
  const dorsalOutL = new THREE.Vector3()
    .crossVectors(handAxisL, forwardRef)
    .normalize();
  // Anterior thumb-side vector (+Z forward)
  const thumbSideL = new THREE.Vector3()
    .crossVectors(dorsalOutL, handAxisL)
    .normalize();

  const toWorld = (alongFrac: number, widthFrac: number, thickFrac: number) => {
    const ptL = wristCenterL
      .clone()
      .addScaledVector(handAxisL, alongFrac * handLengthM)
      .addScaledVector(thumbSideL, widthFrac * (handWidthM * 0.5))
      .addScaledVector(dorsalOutL, thickFrac * wristAxesA);
    if (side === 'right') {
      ptL.x = -ptL.x;
    }
    return ptL;
  };

  // 1. Lofted Palm (from wrist alongFrac=0 to knuckle base alongFrac=0.52)
  const palmSlices = [
    { u: 0.0, wScale: wristAxesB / (handWidthM * 0.5), tScale: 1.0, wShift: 0 },
    { u: 0.16, wScale: 0.92, tScale: 0.92, wShift: 0.08 },
    { u: 0.34, wScale: 1.04, tScale: 0.82, wShift: 0.06 },
    { u: 0.5, wScale: 1.0, tScale: 0.7, wShift: 0.0 },
    { u: 0.54, wScale: 0.95, tScale: 0.58, wShift: 0.0 },
  ];

  const palmSegs = 28;
  const palmRings: THREE.Vector3[][] = palmSlices.map((sl) => {
    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < palmSegs; s++) {
      const theta = (s / palmSegs) * Math.PI * 2;
      const w = Math.sin(theta) * sl.wScale + sl.wShift;
      const t = Math.cos(theta) * sl.tScale;
      ring.push(toWorld(sl.u, w, t));
    }
    if (side === 'right') ring.reverse();
    return ring;
  });
  const palmGeo = buildLoftedGeometry(palmRings, true, true);

  // 2. Four Fingers (Index, Middle, Ring, Pinky) + Opposable Thumb
  const fingerSpecs = [
    // Index finger (anterior side, widthFrac ≈ +0.72)
    {
      uStart: 0.51,
      uLen: 0.44,
      wBase: 0.72,
      wSplay: 0.78,
      radiusW: 0.21,
      radiusT: 0.46,
      curlT: -0.22,
    },
    // Middle finger (longest, widthFrac ≈ +0.24)
    {
      uStart: 0.52,
      uLen: 0.48,
      wBase: 0.24,
      wSplay: 0.25,
      radiusW: 0.22,
      radiusT: 0.48,
      curlT: -0.25,
    },
    // Ring finger (widthFrac ≈ -0.24)
    {
      uStart: 0.51,
      uLen: 0.45,
      wBase: -0.24,
      wSplay: -0.27,
      radiusW: 0.21,
      radiusT: 0.45,
      curlT: -0.28,
    },
    // Little pinky finger (posterior side, widthFrac ≈ -0.72)
    {
      uStart: 0.49,
      uLen: 0.37,
      wBase: -0.72,
      wSplay: -0.82,
      radiusW: 0.18,
      radiusT: 0.4,
      curlT: -0.32,
    },
    // Opposable Thumb (emerges from lower anterior palm uStart=0.22, angles forward & slightly inward)
    {
      uStart: 0.22,
      uLen: 0.38,
      wBase: 0.85,
      wSplay: 1.38,
      radiusW: 0.26,
      radiusT: 0.54,
      curlT: -0.18,
    },
  ];

  const fingerGeos: THREE.BufferGeometry[] = [palmGeo];
  const fingerSegs = 14;
  const fingerStations = [0.0, 0.35, 0.68, 0.92, 1.0];

  for (const fg of fingerSpecs) {
    const fRings: THREE.Vector3[][] = fingerStations.map((st) => {
      const u = fg.uStart + st * fg.uLen;
      const wCenter = THREE.MathUtils.lerp(fg.wBase, fg.wSplay, st);
      const tCenter = Math.pow(st, 1.7) * fg.curlT;
      // Taper finger thickness & width toward fingernail tip
      const taper =
        st < 0.9 ? 1 - st * 0.24 : Math.max(0.15, (1 - st) * 7.5);
      // Slight knuckle swell at PIP joint (st ≈ 0.35)
      const jointSwell = st === 0.35 ? 1.06 : 1.0;

      const ring: THREE.Vector3[] = [];
      for (let s = 0; s < fingerSegs; s++) {
        const theta = (s / fingerSegs) * Math.PI * 2;
        const w = wCenter + Math.sin(theta) * fg.radiusW * taper * jointSwell;
        const t = tCenter + Math.cos(theta) * fg.radiusT * taper * jointSwell;
        ring.push(toWorld(u, w, t));
      }
      if (side === 'right') ring.reverse();
      return ring;
    });
    fingerGeos.push(buildLoftedGeometry(fRings, true, true));
  }

  // Discard unused sign warning
  void sign;
  return mergeBufferGeometries(fingerGeos);
}

/**
 * Builds an anatomical lofted human foot mesh from ankle down to floor (Y = 0)
 * featuring calcaneus heel contour, medial longitudinal arch, sloped dorsal instep,
 * metatarsal ball breadth, and 5 sculpted toes (hallux to fifth toe).
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
  const ballZ = ankleCenter.z + footLengthM * 0.52;
  const toeBaseZ = ankleCenter.z + footLengthM * 0.58;
  const toeTipZ = ankleCenter.z + footLengthM * 0.75;

  const halfW = footWidthM * 0.5;
  const radialSegments = 40;

  const slices = [
    {
      y: 0.0015,
      zMin: heelZ + 0.008,
      zMax: toeBaseZ + 0.006,
      halfWidth: halfW * 0.9,
      xOffset: sign * 0.004,
      archCarve: 0.22,
    },
    {
      y: 0.009,
      zMin: heelZ + 0.002,
      zMax: toeBaseZ + 0.01,
      halfWidth: halfW * 0.99,
      xOffset: sign * 0.004,
      archCarve: 0.26,
    },
    {
      y: 0.019,
      zMin: heelZ,
      zMax: toeBaseZ + 0.005,
      halfWidth: halfW,
      xOffset: sign * 0.0035,
      archCarve: 0.24,
    },
    {
      y: 0.032,
      zMin: heelZ + 0.004,
      zMax: ballZ,
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

      const isOuterSide = sign * cosT > 0;
      let widthScale = 1.0;

      if (sinT < -0.2) {
        widthScale = 0.72 + 0.22 * (1 + sinT);
      } else if (!isOuterSide && Math.abs(sinT) < 0.35) {
        widthScale = 1.0 - slice.archCarve * (1 - Math.abs(sinT) / 0.35);
      }

      const x =
        ankleCenter.x + slice.xOffset + cosT * slice.halfWidth * widthScale;
      const z = zCenter + sinT * zHalf;
      pts.push(new THREE.Vector3(x, slice.y, z));
    }
    return pts;
  });

  const mainFootGeo = buildLoftedGeometry(rings, true, true);

  // Add 5 sculpted toes from toeBaseZ to toeTipZ (Hallux big toe on medial side -> pinky toe on lateral side)
  const toeGeos: THREE.BufferGeometry[] = [mainFootGeo];
  const toeSpecs = [
    // 1. Hallux (Big toe — medial side, sign * -0.68)
    { medFrac: -0.66, lenFrac: 1.0, radW: 0.23, radH: 0.011 },
    // 2. Index toe (Second toe)
    { medFrac: -0.24, lenFrac: 0.96, radW: 0.16, radH: 0.0095 },
    // 3. Middle toe
    { medFrac: 0.12, lenFrac: 0.88, radW: 0.15, radH: 0.009 },
    // 4. Fourth toe
    { medFrac: 0.44, lenFrac: 0.78, radW: 0.14, radH: 0.0082 },
    // 5. Little fifth toe (lateral side)
    { medFrac: 0.74, lenFrac: 0.64, radW: 0.13, radH: 0.0075 },
  ];

  const toeSpanZ = Math.max(0.025, toeTipZ - toeBaseZ);
  const toeSegs = 12;
  const toeSt = [0.0, 0.45, 0.85, 1.0];

  for (const ts of toeSpecs) {
    const xToeCenter =
      ankleCenter.x + sign * (0.0035 + ts.medFrac * halfW * 0.88);
    const tRings: THREE.Vector3[][] = toeSt.map((st) => {
      const z = toeBaseZ - 0.004 + st * toeSpanZ * ts.lenFrac;
      const taper = st < 0.85 ? 1 - st * 0.15 : Math.max(0.2, (1 - st) * 5.5);
      const yCenter = 0.002 + ts.radH * 0.95;
      const ring: THREE.Vector3[] = [];
      for (let s = 0; s < toeSegs; s++) {
        const theta = (s / toeSegs) * Math.PI * 2;
        const x = xToeCenter + Math.cos(theta) * halfW * ts.radW * taper;
        const y = Math.max(
          0.0015,
          yCenter + Math.sin(theta) * ts.radH * taper
        );
        ring.push(new THREE.Vector3(x, y, z));
      }
      return ring;
    });
    toeGeos.push(buildLoftedGeometry(tRings, true, true));
  }

  return mergeBufferGeometries(toeGeos);
}

export const ParametricBody: React.FC = () => {
  const gender = useAtelierStore((s) => s.gender);
  const measurements = useAtelierStore((s) => s.measurements);
  const surfaceFinish = useAtelierStore((s) => s.glassSettings.surfaceFinish);
  const theme = useAtelierStore((s) => s.glassSettings.theme);

  const {
    torsoGeometry,
    headGeometry,
    leftArmGeometry,
    rightArmGeometry,
    leftHandGeometry,
    rightHandGeometry,
    leftLegGeometry,
    rightLegGeometry,
    leftFootGeometry,
    rightFootGeometry,
  } = useMemo(() => {
    const L = computeAnatomicalLandmarks(measurements, gender);
    const torsoEval = createTorsoEvaluator(measurements, gender, L);
    const limbEval = createLimbEvaluators(measurements, gender, L);

    // 1. 96-Ring High-Resolution Lofted Torso, Pelvis, Trapezius & Neck (up to yJaw - 0.008)
    const TORSO_RINGS = 96;
    const TORSO_SEGMENTS = 72;
    const torsoTopY = L.yJaw - 0.008;
    const torsoRings: THREE.Vector3[][] = [];
    for (let i = 0; i < TORSO_RINGS; i++) {
      const u = i / (TORSO_RINGS - 1);
      const y = THREE.MathUtils.lerp(L.yCrotch, torsoTopY, u);
      const ring = torsoEval.sampleClosedRing(y, TORSO_SEGMENTS, 0);
      torsoRings.push(ring);
    }
    const torsoGeo = buildLoftedGeometry(torsoRings, true, true);

    // 2. Sims-4 Style Sculpted Head & Face (Eyes, Nose, Lips, Chin, Jawline, Brow, Ears)
    const neckEval = torsoEval.evalAtY(L.yJaw - 0.014).radii;
    const headGeo = buildSculptedHeadAndFaceGeometry(
      L,
      measurements.head * CM_TO_M,
      neckEval.a,
      (neckEval.bFront + neckEval.bBack) * 0.5,
      neckEval.centerZ
    );

    // 3. 42-Ring Multi-Segment Lofted Arms (Shoulder Deltoid to Distal Wrist t=0..0.84)
    const ARM_RINGS = 42;
    const ARM_SEGMENTS = 44;
    const leftArmRings: THREE.Vector3[][] = [];
    const rightArmRings: THREE.Vector3[][] = [];

    for (let i = 0; i < ARM_RINGS; i++) {
      const t = (i / (ARM_RINGS - 1)) * 0.845;
      leftArmRings.push(limbEval.sampleArmRing('left', t, ARM_SEGMENTS, 0));
      const rightRing = limbEval
        .sampleArmRing('right', t, ARM_SEGMENTS, 0)
        .reverse();
      rightArmRings.push(rightRing);
    }

    const leftArmGeo = buildLoftedGeometry(leftArmRings, true, true);
    const rightArmGeo = buildLoftedGeometry(rightArmRings, true, true);

    // 4. Articulated 5-Finger Sculpted Hands (Left & Right)
    const handLenM = measurements.handLength * CM_TO_M;
    const handWidthM = measurements.handWidth * CM_TO_M;
    const wristRad = (measurements.wrist * CM_TO_M) / (2 * Math.PI);
    const leftHandGeo = buildSculptedHandGeometry(
      'left',
      L.armWristL,
      L.handTipL,
      handLenM,
      handWidthM,
      wristRad * 0.84,
      wristRad * 1.16
    );
    const rightHandGeo = buildSculptedHandGeometry(
      'right',
      L.armWristL,
      L.handTipL,
      handLenM,
      handWidthM,
      wristRad * 0.84,
      wristRad * 1.16
    );

    // 5. 52-Ring Multi-Segment Lofted Legs (Pelvis-integrated Hip to Ankle)
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

    // 6. Sculpted Anatomical Feet with 5 Toes driven by footLength and footWidth
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
      headGeometry: headGeo,
      leftArmGeometry: leftArmGeo,
      rightArmGeometry: rightArmGeo,
      leftHandGeometry: leftHandGeo,
      rightHandGeometry: rightHandGeo,
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
        roughness: 0.78,
        metalness: 0.02,
        clearcoat: 0.06,
        sheen: 0.28,
        sheenRoughness: 0.75,
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
    // Default: 'satin' (Satin Resin / Sims-style smooth subsurface look)
    return {
      color: isLight ? '#cfd6e2' : '#c2cce0',
      roughness: 0.3,
      metalness: 0.06,
      clearcoat: 0.42,
      clearcoatRoughness: 0.24,
      sheen: 0.25,
      sheenRoughness: 0.45,
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
      {/* 96-Ring Lofted Torso, Pelvis, Trapezius & Neck */}
      <mesh
        geometry={torsoGeometry}
        material={sharedMaterial}
        castShadow
        receiveShadow
      />

      {/* Sims-4 Style Sculpted Head & Face (Eyes, Nose, Lips, Chin, Ears) */}
      <mesh
        geometry={headGeometry}
        material={sharedMaterial}
        castShadow
        receiveShadow
      />

      {/* Left & Right Multi-Segment Lofted Arms */}
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

      {/* Left & Right Articulated 5-Finger Sculpted Hands */}
      <mesh
        geometry={leftHandGeometry}
        material={sharedMaterial}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={rightHandGeometry}
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

      {/* Left & Right Sculpted Feet with 5 Toes */}
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
