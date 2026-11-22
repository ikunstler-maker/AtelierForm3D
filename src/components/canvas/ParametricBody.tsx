import React, { useMemo } from 'react';
import * as THREE from 'three';
import {
  AnimeHairstyleId,
  CharacterAppearance,
} from '../../store/useAtelierStore';
import {
  AnatomicalLandmarks,
  CM_TO_M,
  computeAnatomicalLandmarks,
  createLimbEvaluators,
  createTorsoEvaluator,
} from '../../utils/geometryMath';
import { useAtelierStore } from '../../store/useAtelierStore';

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
 * Builds a tapered anime hair ribbon lock along a 3D spline path with an elliptical
 * or diamond cross-section that tapers to a sharp anime tip.
 */
function buildHairStrandGeometry(
  controlPoints: THREE.Vector3[],
  widthBase: number,
  thicknessBase: number,
  steps = 18,
  radialSegs = 10,
  tipSharpness = 1.6
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(
    controlPoints,
    false,
    'centripetal',
    0.4
  );
  const rings: THREE.Vector3[][] = [];

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const center = curve.getPoint(u);
    const tangent = curve.getTangent(u).normalize();

    // Outward normal from vertical head axis
    const radialRef = new THREE.Vector3(center.x, 0, center.z);
    if (radialRef.lengthSq() < 1e-5) radialRef.set(0, 0, 1);
    radialRef.normalize();

    let sideVec = new THREE.Vector3().crossVectors(tangent, radialRef);
    if (sideVec.lengthSq() < 1e-5) sideVec.set(1, 0, 0);
    sideVec.normalize();
    const outVec = new THREE.Vector3()
      .crossVectors(sideVec, tangent)
      .normalize();

    // Swell slightly in middle, taper cleanly to tip
    const profile =
      u < 0.2
        ? 0.72 + 1.4 * u
        : Math.max(0.03, Math.pow(1 - (u - 0.2) / 0.8, tipSharpness));

    const w = widthBase * profile;
    const th = thicknessBase * profile;

    const ring: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegs; s++) {
      const angle = (s / radialSegs) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      // Slight outer ridge for anime hair lock crease
      const ridge = sinA > 0 ? 1.15 : 0.85;
      const pt = center
        .clone()
        .addScaledVector(sideVec, cosA * w)
        .addScaledVector(outVec, sinA * th * ridge);
      ring.push(pt);
    }
    rings.push(ring);
  }

  return buildLoftedGeometry(rings, true, true);
}

/**
 * Procedural 3D Anime Hairstyle Generator supporting 8 distinct hairstyles:
 * - 'twintails' (Anime Twintails with ribbons + hime side locks + bangs)
 * - 'himeLong' (Long straight Hime cut with cheek side-locks + full fringe)
 * - 'shortBob' (Layered anime bob with inward-curled tips + bangs)
 * - 'spikyShonen' (Dynamic multi-layered spiky anime locks)
 * - 'highPonytail' (Swept-back crown + high tie + long flowing cascade + bangs)
 * - 'wolfCut' (Shaggy layered anime wolf cut with feathered neck locks)
 * - 'odangoBuns' (Twin high spherical Odango buns + long trailing ribbons)
 * - 'buzzNone' (No hair / pure sculptural mannequin)
 */
function buildAnimeHairstyleGeometry(
  style: AnimeHairstyleId,
  L: AnatomicalLandmarks,
  headWidthA: number,
  headDepthB: number,
  centerZ: number,
  app: CharacterAppearance
): THREE.BufferGeometry | null {
  if (style === 'buzzNone') return null;

  const vol = app.hairVolume;
  const bangsScale = app.bangsLength;
  const backScale = app.backHairLength;
  const headH = Math.max(0.18, L.yCrown - L.yJaw);
  const yCenter = L.yJaw + headH * 0.56;
  const aCap = headWidthA * 1.07 * Math.sqrt(vol);
  const bCap = headDepthB * 1.07 * Math.sqrt(vol);

  const geos: THREE.BufferGeometry[] = [];

  // 1. Base Cranial Hair Dome (covers top, sides, and back of skull above yJaw + 0.34*headH)
  {
    const domeRings: THREE.Vector3[][] = [];
    const numDomeRings = 16;
    const domeSegs = 40;
    const yStart = L.yJaw + headH * 0.34;
    const yTop = L.yCrown + 0.015 * vol;

    for (let r = 0; r < numDomeRings; r++) {
      const u = r / (numDomeRings - 1);
      const y = THREE.MathUtils.lerp(yStart, yTop, u);
      const ring: THREE.Vector3[] = [];
      const domeProfile =
        u < 0.35
          ? 0.92 + 0.22 * (u / 0.35)
          : Math.sqrt(Math.max(0.01, 1 - Math.pow((u - 0.35) / 0.65, 1.85)));

      for (let s = 0; s < domeSegs; s++) {
        const theta = (s / domeSegs) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        // Carve out face opening in front (sinT > 0.25) on lower rings (u < 0.58)
        let frontRecess = 1.0;
        if (sinT > 0.15 && u < 0.62) {
          const faceWindow =
            Math.pow((0.62 - u) / 0.62, 1.2) *
            Math.pow((sinT - 0.15) / 0.85, 1.3);
          frontRecess = 1.0 - 0.38 * faceWindow;
        }

        const x = aCap * domeProfile * cosT * frontRecess;
        const z =
          centerZ +
          0.008 +
          bCap * domeProfile * sinT * frontRecess -
          (sinT < 0 ? 0.008 * vol : 0);
        ring.push(new THREE.Vector3(x, y, z));
      }
      domeRings.push(ring);
    }
    geos.push(buildLoftedGeometry(domeRings, false, true));
  }

  // 2. Front Anime Bangs / Fringe (7 tapered locks framing the forehead and eyes)
  const bangAngles = [-0.62, -0.41, -0.21, 0.0, 0.21, 0.41, 0.62];
  const yCrownRoot = L.yCrown + 0.008 * vol;
  const yForehead = L.yJaw + headH * 0.72;
  const yBrowLine = L.yJaw + headH * (0.48 - 0.12 * (bangsScale - 1.0));

  for (let i = 0; i < bangAngles.length; i++) {
    const ang = bangAngles[i];
    const isOuter = Math.abs(i - 3) >= 2;
    const isCenter = i === 3;
    const x1 = Math.sin(ang) * aCap * 0.86;
    const z1 = centerZ + 0.014 + Math.cos(ang) * bCap * 0.96;

    const lengthMult = isOuter ? 1.18 : isCenter ? 1.04 : 0.96;
    const yTip =
      L.yJaw +
      headH * 0.72 -
      (headH * 0.26 * bangsScale * lengthMult);

    // Slight curve sweeping outward or inward
    const sweepX = x1 * (isOuter ? 1.08 : 0.92);
    const pts = [
      new THREE.Vector3(x1 * 0.35, yCrownRoot, centerZ + bCap * 0.35),
      new THREE.Vector3(x1 * 0.88, yForehead + 0.015, z1 * 0.98),
      new THREE.Vector3(x1 * 1.02, (yForehead + yBrowLine) * 0.5, z1 + 0.011),
      new THREE.Vector3(sweepX, yTip, z1 + 0.004),
    ];

    geos.push(
      buildHairStrandGeometry(
        pts,
        (isOuter ? 0.022 : 0.019) * vol,
        0.011 * vol,
        16,
        10,
        1.5
      )
    );
  }

  // 3. Cheek-framing Side Locks (Hime / Anime Temple Strands on Left & Right)
  for (const sign of [-1, 1]) {
    const sideLen =
      style === 'himeLong' || style === 'twintails' || style === 'odangoBuns'
        ? 0.18 * bangsScale
        : 0.13 * bangsScale;

    const xTemple = sign * aCap * 0.97;
    const zTemple = centerZ + bCap * 0.32;
    const yTemple = L.yJaw + headH * 0.62;

    const pts = [
      new THREE.Vector3(sign * aCap * 0.72, L.yCrown - 0.01, zTemple * 0.7),
      new THREE.Vector3(xTemple, yTemple, zTemple),
      new THREE.Vector3(
        xTemple * 1.02,
        L.yJaw + headH * 0.22,
        zTemple + 0.012
      ),
      new THREE.Vector3(
        xTemple * 0.85,
        L.yJaw - sideLen + 0.07,
        zTemple + 0.016
      ),
    ];
    geos.push(
      buildHairStrandGeometry(pts, 0.018 * vol, 0.011 * vol, 18, 10, 1.4)
    );
  }

  // 4. Style-Specific Main Hair Architecture
  if (style === 'twintails') {
    // High Left & Right Twintail Ponytails with Ribbon Cuffs
    for (const sign of [-1, 1]) {
      const rootX = sign * aCap * 0.92;
      const rootY = L.yJaw + headH * 0.72;
      const rootZ = centerZ - bCap * 0.15;
      const tailLen = 0.42 * backScale;

      // Decorative Hair Tie Cuff
      const cuffGeo = new THREE.TorusGeometry(0.024 * vol, 0.008 * vol, 12, 24);
      cuffGeo.rotateY(sign * 0.7);
      cuffGeo.rotateX(0.4);
      cuffGeo.translate(rootX * 1.05, rootY, rootZ);
      geos.push(cuffGeo);

      // 3 Flowing locks per twintail for rich anime silhouette
      const offsets = [
        { dx: 0.0, dz: 0.0, w: 0.036 },
        { dx: sign * 0.024, dz: 0.018, w: 0.026 },
        { dx: sign * 0.016, dz: -0.022, w: 0.028 },
      ];
      for (const off of offsets) {
        const pts = [
          new THREE.Vector3(rootX, rootY, rootZ),
          new THREE.Vector3(
            rootX * 1.45 + off.dx,
            rootY + 0.025,
            rootZ + off.dz
          ),
          new THREE.Vector3(
            rootX * 1.85 + off.dx * 1.5,
            rootY - tailLen * 0.42,
            rootZ - 0.02 + off.dz
          ),
          new THREE.Vector3(
            rootX * 1.65 + off.dx * 1.8,
            rootY - tailLen * 0.82,
            rootZ + 0.015 + off.dz
          ),
          new THREE.Vector3(
            rootX * 1.9 + off.dx * 2.0,
            rootY - tailLen,
            rootZ + 0.04 + off.dz
          ),
        ];
        geos.push(
          buildHairStrandGeometry(
            pts,
            off.w * vol,
            0.022 * vol,
            24,
            12,
            1.4
          )
        );
      }
    }
  } else if (style === 'himeLong') {
    // Long flowing back curtain of 9 sculpted vertical locks reaching mid-back/waist
    const numBackLocks = 9;
    const tailLen = 0.46 * backScale;
    for (let i = 0; i < numBackLocks; i++) {
      const frac = (i / (numBackLocks - 1)) * 2 - 1; // -1 to +1
      const theta = Math.PI * 1.5 + frac * 0.85; // posterior arc
      const rx = Math.cos(theta) * aCap * 0.96;
      const rz = centerZ + Math.sin(theta) * bCap * 0.98;

      const pts = [
        new THREE.Vector3(rx * 0.6, L.yCrown - 0.01, rz * 0.6),
        new THREE.Vector3(rx * 1.04, L.yJaw + headH * 0.45, rz - 0.008),
        new THREE.Vector3(rx * 1.12, L.yShoulder + 0.02, rz - 0.032),
        new THREE.Vector3(
          rx * 1.24,
          L.yShoulder - tailLen * 0.55,
          rz - 0.048
        ),
        new THREE.Vector3(rx * 1.18, L.yShoulder - tailLen, rz - 0.035),
      ];
      geos.push(
        buildHairStrandGeometry(pts, 0.032 * vol, 0.016 * vol, 24, 10, 1.35)
      );
    }
  } else if (style === 'shortBob') {
    // Classic Anime Chin/Neck Bob with inward-curled tips around posterior and lateral perimeter
    const numBobLocks = 13;
    const bobDrop = 0.055 * backScale;
    for (let i = 0; i < numBobLocks; i++) {
      const frac = (i / (numBobLocks - 1)) * 2 - 1; // -1 to +1
      const theta = Math.PI * 1.5 + frac * 1.28;
      const rx = Math.cos(theta) * aCap;
      const rz = centerZ + Math.sin(theta) * bCap;

      const pts = [
        new THREE.Vector3(rx * 0.5, L.yCrown, rz * 0.5),
        new THREE.Vector3(rx * 1.08, L.yJaw + headH * 0.5, rz * 1.06),
        new THREE.Vector3(rx * 1.14, L.yJaw + 0.015, rz * 1.1),
        new THREE.Vector3(rx * 0.82, L.yJaw - bobDrop, rz * 0.84),
      ];
      geos.push(
        buildHairStrandGeometry(pts, 0.028 * vol, 0.016 * vol, 18, 10, 1.45)
      );
    }
  } else if (style === 'spikyShonen') {
    // Multi-layered outward-flaring Shonen Anime Spikes around crown, sides, and nape
    const spikeSpecs = [
      // Crown & Upper Back Spikes
      { angH: 0.0, yBase: 0.78, flareY: 0.08, len: 0.14, w: 0.032 },
      { angH: 0.45, yBase: 0.74, flareY: 0.06, len: 0.14, w: 0.03 },
      { angH: -0.45, yBase: 0.74, flareY: 0.06, len: 0.14, w: 0.03 },
      { angH: 0.9, yBase: 0.66, flareY: 0.03, len: 0.13, w: 0.028 },
      { angH: -0.9, yBase: 0.66, flareY: 0.03, len: 0.13, w: 0.028 },
      // Mid-level lateral & back spikes
      { angH: 0.25, yBase: 0.52, flareY: -0.02, len: 0.13, w: 0.03 },
      { angH: -0.25, yBase: 0.52, flareY: -0.02, len: 0.13, w: 0.03 },
      { angH: 0.72, yBase: 0.48, flareY: -0.03, len: 0.125, w: 0.027 },
      { angH: -0.72, yBase: 0.48, flareY: -0.03, len: 0.125, w: 0.027 },
      { angH: 1.15, yBase: 0.48, flareY: -0.04, len: 0.11, w: 0.025 },
      { angH: -1.15, yBase: 0.48, flareY: -0.04, len: 0.11, w: 0.025 },
      // Nape spikes
      { angH: 0.0, yBase: 0.3, flareY: -0.06, len: 0.1, w: 0.026 },
      { angH: 0.48, yBase: 0.32, flareY: -0.06, len: 0.1, w: 0.024 },
      { angH: -0.48, yBase: 0.32, flareY: -0.06, len: 0.1, w: 0.024 },
    ];

    for (const sp of spikeSpecs) {
      const theta = Math.PI * 1.5 + sp.angH;
      const dirX = Math.cos(theta);
      const dirZ = Math.sin(theta);
      const y0 = L.yJaw + headH * sp.yBase;
      const rx = dirX * aCap * 0.9;
      const rz = centerZ + dirZ * bCap * 0.9;
      const Lspike = sp.len * backScale * vol;

      const pts = [
        new THREE.Vector3(rx * 0.5, y0, rz * 0.5),
        new THREE.Vector3(rx, y0 + sp.flareY * 0.4, rz),
        new THREE.Vector3(
          rx + dirX * Lspike * 0.6,
          y0 + sp.flareY * 0.8,
          rz + dirZ * Lspike * 0.6
        ),
        new THREE.Vector3(
          rx + dirX * Lspike,
          y0 + sp.flareY * 1.3 + 0.012,
          rz + dirZ * Lspike
        ),
      ];
      geos.push(
        buildHairStrandGeometry(pts, sp.w * vol, sp.w * 0.65 * vol, 14, 10, 1.8)
      );
    }
  } else if (style === 'highPonytail') {
    // High energetic back ponytail with hair cuff and 4 cascading ribbons
    const rootY = L.yJaw + headH * 0.74;
    const rootZ = centerZ - bCap * 0.95;
    const tailLen = 0.42 * backScale;

    const cuffGeo = new THREE.TorusGeometry(0.026 * vol, 0.009 * vol, 12, 24);
    cuffGeo.rotateX(0.65);
    cuffGeo.translate(0, rootY, rootZ);
    geos.push(cuffGeo);

    const strands = [
      { dx: 0.0, dy: 0.04, w: 0.038 },
      { dx: 0.028, dy: 0.02, w: 0.028 },
      { dx: -0.028, dy: 0.02, w: 0.028 },
      { dx: 0.0, dy: -0.01, w: 0.032 },
    ];
    for (const st of strands) {
      const pts = [
        new THREE.Vector3(0, rootY, rootZ),
        new THREE.Vector3(st.dx, rootY + st.dy, rootZ - 0.065),
        new THREE.Vector3(
          st.dx * 1.6,
          rootY - tailLen * 0.38,
          rootZ - 0.11
        ),
        new THREE.Vector3(
          st.dx * 1.4,
          rootY - tailLen * 0.78,
          rootZ - 0.085
        ),
        new THREE.Vector3(st.dx * 1.8, rootY - tailLen, rootZ - 0.12),
      ];
      geos.push(
        buildHairStrandGeometry(pts, st.w * vol, 0.022 * vol, 24, 12, 1.45)
      );
    }
  } else if (style === 'wolfCut') {
    // Layered textured Anime Wolf Cut (short flared upper crown locks + longer feathered neck/shoulder locks)
    const numLocks = 11;
    const neckLen = 0.18 * backScale;
    for (let i = 0; i < numLocks; i++) {
      const frac = (i / (numLocks - 1)) * 2 - 1;
      const theta = Math.PI * 1.5 + frac * 1.22;
      const rx = Math.cos(theta) * aCap;
      const rz = centerZ + Math.sin(theta) * bCap;

      // Upper flared wolf-layer
      const upperPts = [
        new THREE.Vector3(rx * 0.4, L.yCrown, rz * 0.4),
        new THREE.Vector3(rx * 1.08, L.yJaw + headH * 0.56, rz * 1.06),
        new THREE.Vector3(rx * 1.24, L.yJaw + headH * 0.25, rz * 1.2),
      ];
      geos.push(
        buildHairStrandGeometry(upperPts, 0.028 * vol, 0.015 * vol, 14, 10, 1.6)
      );

      // Lower feathered neck-layer flipping outward at collarbone
      const lowerPts = [
        new THREE.Vector3(rx * 0.85, L.yJaw + headH * 0.35, rz * 0.9),
        new THREE.Vector3(rx * 0.98, L.yJaw - 0.01, rz * 1.02),
        new THREE.Vector3(rx * 1.15, L.yJaw - neckLen * 0.65, rz * 1.12),
        new THREE.Vector3(rx * 1.32, L.yJaw - neckLen, rz * 1.24),
      ];
      geos.push(
        buildHairStrandGeometry(lowerPts, 0.025 * vol, 0.014 * vol, 16, 10, 1.5)
      );
    }
  } else if (style === 'odangoBuns') {
    // Twin Spherical Odango Buns on top-sides + long ribbon streamers
    for (const sign of [-1, 1]) {
      const bunX = sign * aCap * 0.88;
      const bunY = L.yCrown - 0.008;
      const bunZ = centerZ - 0.01;

      const bunGeo = new THREE.SphereGeometry(0.044 * vol, 24, 20);
      bunGeo.translate(bunX, bunY, bunZ);
      geos.push(bunGeo);

      const cuffGeo = new THREE.TorusGeometry(0.032 * vol, 0.008 * vol, 10, 20);
      cuffGeo.rotateY(sign * 0.6);
      cuffGeo.rotateX(0.9);
      cuffGeo.translate(bunX * 0.9, bunY - 0.01, bunZ);
      geos.push(cuffGeo);

      // Long ribbon lock falling from underneath each Odango bun
      const tailLen = 0.38 * backScale;
      const pts = [
        new THREE.Vector3(bunX, bunY - 0.02, bunZ),
        new THREE.Vector3(bunX * 1.35, L.yJaw + headH * 0.35, bunZ - 0.02),
        new THREE.Vector3(bunX * 1.48, L.yJaw - tailLen * 0.45, bunZ - 0.01),
        new THREE.Vector3(bunX * 1.38, L.yJaw - tailLen, bunZ + 0.02),
      ];
      geos.push(
        buildHairStrandGeometry(pts, 0.026 * vol, 0.016 * vol, 22, 10, 1.4)
      );
    }
  }

  // 5. Iconic Anime Ahoge (Bouncy Top Cowlick Antenna Strand)
  if (app.ahogeEnabled) {
    const ahogePts = [
      new THREE.Vector3(0, L.yCrown + 0.006 * vol, centerZ + 0.01),
      new THREE.Vector3(0.018, L.yCrown + 0.048 * vol, centerZ + 0.032),
      new THREE.Vector3(0.042, L.yCrown + 0.068 * vol, centerZ + 0.025),
      new THREE.Vector3(0.062, L.yCrown + 0.044 * vol, centerZ + 0.018),
    ];
    geos.push(
      buildHairStrandGeometry(ahogePts, 0.012 * vol, 0.007 * vol, 16, 8, 1.8)
    );
  }

  return mergeBufferGeometries(geos);
}

/**
 * Builds a Sims-4 / Anime CAS style sculpted head & face geometry parameterized by
 * all face sliders (faceRoundness, chinSharpness, noseSize, noseHeight, mouthWidth,
 * lipFullness, earSize, elfEars, expression, and animeStyleEnabled).
 */
function buildSculptedHeadAndFaceGeometry(
  L: AnatomicalLandmarks,
  headCircumferenceM: number,
  neckRadiusA: number,
  neckRadiusB: number,
  centerZNeck: number,
  app: CharacterAppearance
): {
  headGeo: THREE.BufferGeometry;
  eyeAnchors: {
    leftEye: THREE.Vector3;
    rightEye: THREE.Vector3;
    leftCheekBlush: THREE.Vector3;
    rightCheekBlush: THREE.Vector3;
    mouthCenter: THREE.Vector3;
    headWidthA: number;
    headDepthB: number;
    centerZHead: number;
  };
} {
  const isFemale = L.gender === 'female';
  const isAnime = app.animeStyleEnabled;

  const baseHeadWidthA = (headCircumferenceM / (2 * Math.PI)) * 0.91;
  const baseHeadDepthB = (headCircumferenceM / (2 * Math.PI)) * 1.09;
  const headWidthA = baseHeadWidthA * (0.88 + 0.12 * app.faceRoundness);
  const headDepthB = baseHeadDepthB;

  const yNeckTop = L.yJaw - 0.014;
  const headHeight = Math.max(0.18, L.yCrown - L.yJaw);
  const yChin = L.yJaw;
  const yLowerLip = L.yJaw + headHeight * 0.14;
  const yMouthCleft = L.yJaw + headHeight * 0.175;
  const yUpperLip = L.yJaw + headHeight * 0.21;
  const noseOffsetM = app.noseHeight * 0.014;
  const yNoseBase = L.yJaw + headHeight * 0.27 + noseOffsetM;
  const yNoseTip = L.yJaw + headHeight * 0.31 + noseOffsetM;
  const yEyeCenter = L.yJaw + headHeight * (isAnime ? 0.43 : 0.45);
  const yBrowRidge = L.yJaw + headHeight * 0.54 + app.browHeight * 0.012;

  const numRings = 58;
  const radialSegments = 72;
  const rings: THREE.Vector3[][] = [];

  const g1 = (v: number, c: number, s: number) =>
    Math.exp(-0.5 * Math.pow((v - c) / Math.max(1e-4, s), 2));

  const cZ = centerZNeck + 0.01;

  for (let r = 0; r < numRings; r++) {
    const u = r / (numRings - 1);
    const y = THREE.MathUtils.lerp(yNeckTop, L.yCrown, u);
    const hNorm = Math.max(0, Math.min(1, (y - L.yJaw) / headHeight));

    let a = headWidthA;
    let bF = headDepthB * 0.98;
    let bB = headDepthB * 1.04;

    if (y < L.yJaw) {
      const tNeck = (y - yNeckTop) / Math.max(0.005, L.yJaw - yNeckTop);
      a = THREE.MathUtils.lerp(neckRadiusA * 0.96, headWidthA * 0.68, tNeck);
      bF = THREE.MathUtils.lerp(neckRadiusB * 0.98, headDepthB * 0.84, tNeck);
      bB = THREE.MathUtils.lerp(neckRadiusB * 0.98, headDepthB * 0.82, tNeck);
    } else if (hNorm < 0.46) {
      // Lower face V-taper controlled by chinSharpness and faceRoundness
      const tFace = hNorm / 0.46;
      const baseJawRatio = isFemale ? 0.65 : 0.72;
      const sharpAdjust = (app.chinSharpness - 1.0) * 0.22;
      const jawTaper = Math.max(0.45, Math.min(0.86, baseJawRatio - sharpAdjust));
      const curveExp = isAnime
        ? Math.max(0.45, 0.72 / app.faceRoundness)
        : 0.65;
      a = headWidthA * THREE.MathUtils.lerp(jawTaper, 0.99, Math.pow(tFace, curveExp));
      bF = headDepthB * THREE.MathUtils.lerp(0.85, 0.98, Math.pow(tFace, 0.55));
      bB = headDepthB * THREE.MathUtils.lerp(0.76, 1.02, Math.pow(tFace, 0.7));
    } else if (hNorm > 0.72) {
      const tDome = (hNorm - 0.72) / 0.28;
      const domeScale = Math.sqrt(Math.max(0.002, 1 - Math.pow(tDome, 1.85)));
      a = headWidthA * domeScale;
      bF = headDepthB * 0.96 * domeScale;
      bB = headDepthB * 1.04 * domeScale;
    }

    const ringPts: THREE.Vector3[] = [];
    for (let s = 0; s < radialSegments; s++) {
      const theta = (s / radialSegments) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const absCos = Math.abs(cosT);

      let x = a * cosT;
      let z = (sinT >= 0 ? bF : bB) * sinT;

      if (sinT > 0 && y >= L.yJaw - 0.005) {
        // 1. Anime V-Chin & Jawline
        const chinV = g1(y, yChin + 0.008, 0.012);
        const chinWidthSigma =
          (isFemale ? 0.23 : 0.28) / Math.max(0.6, app.chinSharpness);
        const chinH = g1(absCos, 0, chinWidthSigma);
        z +=
          chinV *
          (isFemale ? 0.0125 : 0.015) *
          (0.85 + 0.15 * app.chinSharpness) *
          chinH *
          Math.pow(sinT, 1.4);

        // 2. Lips & Facial Expression Curve
        const smileLift =
          app.expression === 'gentleSmile'
            ? 0.0035
            : app.expression === 'cheerfulOpen'
            ? 0.0055
            : app.expression === 'seriousCool'
            ? -0.002
            : 0.001;
        const cornerCurveY = smileLift * Math.pow(absCos / 0.25, 2);

        const lowerLipV = g1(y - cornerCurveY, yLowerLip, 0.0055);
        const upperLipV = g1(y - cornerCurveY, yUpperLip, 0.0055);
        const mouthCleftV = g1(y - cornerCurveY, yMouthCleft, 0.0028);
        const lipSpanH = g1(absCos, 0, 0.22 * app.mouthWidth);
        const cupidsBow =
          1.0 + 0.22 * g1(absCos, 0.075, 0.045) - 0.15 * g1(absCos, 0, 0.03);

        const lipScale = app.lipFullness * (isAnime ? 0.85 : 1.0);
        z += lowerLipV * 0.0085 * lipScale * lipSpanH * Math.pow(sinT, 2);
        z +=
          upperLipV *
          0.0095 *
          lipScale *
          lipSpanH *
          cupidsBow *
          Math.pow(sinT, 2);
        z -= mouthCleftV * 0.004 * lipSpanH * Math.pow(sinT, 2);

        // 3. Nose (Delicate upturned anime nose tip & subtle bridge)
        const noseScale = app.noseSize * (isAnime ? 0.82 : 1.0);
        const noseTipV = g1(y, yNoseTip, 0.0085);
        const noseBridgeV =
          y >= yNoseTip && y <= yBrowRidge
            ? Math.sin(((y - yNoseTip) / Math.max(0.01, yBrowRidge - yNoseTip)) * Math.PI)
            : 0;
        const noseSubV = g1(y, yNoseBase, 0.0055);
        const noseCenterH = g1(absCos, 0, 0.078 * Math.sqrt(app.noseSize));

        z +=
          (noseTipV * 0.0185 + noseBridgeV * (isAnime ? 0.0095 : 0.0135) + noseSubV * 0.007) *
          noseScale *
          noseCenterH *
          Math.pow(sinT, 3);

        // 4. Eye Sockets & Cheekbones
        const eyeLatCenter = 0.34 * app.eyeSpacing;
        const orbitV = g1(y, yEyeCenter, 0.015 * app.eyeSize);
        const orbitH = g1(absCos, eyeLatCenter, 0.14 * app.eyeSize);
        z -= orbitV * orbitH * (isAnime ? 0.005 : 0.009) * Math.pow(sinT, 1.5);

        const cheekV = g1(y, yNoseTip + 0.008, 0.019);
        const cheekH = g1(absCos, 0.56, 0.19);
        z += cheekV * cheekH * 0.0065 * app.faceRoundness * sinT;
        x +=
          Math.sign(cosT) *
          cheekV *
          cheekH *
          0.0045 *
          app.faceRoundness;
      }

      // 5. Sculpted Ears (with optional Fantasy Pointed Elf Ears)
      const earScale = app.earSize * (app.elfEars ? 1.45 : 1.0);
      const earCenterY =
        (yNoseTip + yEyeCenter) * 0.52 + (app.elfEars ? 0.006 : 0);
      const earV = g1(y, earCenterY, 0.022 * app.earSize);
      const earAngle = g1(sinT, -0.08, 0.11);
      if (earV > 0.02 && earAngle > 0.02) {
        const elfTipBoost =
          app.elfEars && y > earCenterY
            ? 1.0 + 1.15 * ((y - earCenterY) / 0.03)
            : 1.0;
        const earProjection = earV * earAngle * 0.014 * earScale * elfTipBoost;
        x += Math.sign(cosT) * earProjection;
        z -= earProjection * (app.elfEars ? 0.55 : 0.35);
      }

      // 6. Occipital skull curve
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

  // Compute exact 3D surface positions for expressive Anime Eyes, Eyelashes, Brows, and Blush
  const sampleFaceAnchor = (targetY: number, targetAbsCos: number, signX: number) => {
    const sinVal = Math.sqrt(Math.max(0.05, 1 - targetAbsCos * targetAbsCos));
    const hNorm = Math.max(0, Math.min(1, (targetY - L.yJaw) / headHeight));
    const tFace = Math.min(1, hNorm / 0.46);
    const baseJawRatio = isFemale ? 0.65 : 0.72;
    const sharpAdjust = (app.chinSharpness - 1.0) * 0.22;
    const jawTaper = Math.max(0.45, Math.min(0.86, baseJawRatio - sharpAdjust));
    const curveExp = isAnime
      ? Math.max(0.45, 0.72 / app.faceRoundness)
      : 0.65;
    const aAtY =
      hNorm < 0.46
        ? headWidthA * THREE.MathUtils.lerp(jawTaper, 0.99, Math.pow(tFace, curveExp))
        : headWidthA;
    const bFAtY =
      hNorm < 0.46
        ? headDepthB * THREE.MathUtils.lerp(0.85, 0.98, Math.pow(tFace, 0.55))
        : headDepthB * 0.98;

    return new THREE.Vector3(
      signX * aAtY * targetAbsCos,
      targetY,
      cZ + bFAtY * sinVal
    );
  };

  const eyeLat = Math.min(0.55, 0.34 * app.eyeSpacing);
  const leftEye = sampleFaceAnchor(yEyeCenter, eyeLat, 1);
  const rightEye = sampleFaceAnchor(yEyeCenter, eyeLat, -1);
  const leftCheekBlush = sampleFaceAnchor(
    yEyeCenter - headHeight * 0.13,
    Math.min(0.68, eyeLat * 1.32),
    1
  );
  const rightCheekBlush = sampleFaceAnchor(
    yEyeCenter - headHeight * 0.13,
    Math.min(0.68, eyeLat * 1.32),
    -1
  );
  const mouthCenter = sampleFaceAnchor(yMouthCleft, 0.0, 1);

  return {
    headGeo: buildLoftedGeometry(rings, false, true),
    eyeAnchors: {
      leftEye,
      rightEye,
      leftCheekBlush,
      rightCheekBlush,
      mouthCenter,
      headWidthA,
      headDepthB,
      centerZHead: cZ,
    },
  };
}

/**
 * Builds an articulated 5-finger Sims-style hand geometry.
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
  const handAxisL = handTipL.clone().sub(wristCenterL).normalize();
  const forwardRef = new THREE.Vector3(0, 0, 1);
  const dorsalOutL = new THREE.Vector3()
    .crossVectors(handAxisL, forwardRef)
    .normalize();
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

  const fingerSpecs = [
    {
      uStart: 0.51,
      uLen: 0.44,
      wBase: 0.72,
      wSplay: 0.78,
      radiusW: 0.21,
      radiusT: 0.46,
      curlT: -0.22,
    },
    {
      uStart: 0.52,
      uLen: 0.48,
      wBase: 0.24,
      wSplay: 0.25,
      radiusW: 0.22,
      radiusT: 0.48,
      curlT: -0.25,
    },
    {
      uStart: 0.51,
      uLen: 0.45,
      wBase: -0.24,
      wSplay: -0.27,
      radiusW: 0.21,
      radiusT: 0.45,
      curlT: -0.28,
    },
    {
      uStart: 0.49,
      uLen: 0.37,
      wBase: -0.72,
      wSplay: -0.82,
      radiusW: 0.18,
      radiusT: 0.4,
      curlT: -0.32,
    },
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
      const taper =
        st < 0.9 ? 1 - st * 0.24 : Math.max(0.15, (1 - st) * 7.5);
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

  return mergeBufferGeometries(fingerGeos);
}

/**
 * Builds an anatomical lofted human foot mesh with 5 sculpted toes.
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

  const toeGeos: THREE.BufferGeometry[] = [mainFootGeo];
  const toeSpecs = [
    { medFrac: -0.66, lenFrac: 1.0, radW: 0.23, radH: 0.011 },
    { medFrac: -0.24, lenFrac: 0.96, radW: 0.16, radH: 0.0095 },
    { medFrac: 0.12, lenFrac: 0.88, radW: 0.15, radH: 0.009 },
    { medFrac: 0.44, lenFrac: 0.78, radW: 0.14, radH: 0.0082 },
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

/**
 * 3D Expressive Anime Eye Assembly (Sclera, Colored Iris, Dark Pupil,
 * Dual Starlight Sparkle Catchlights, Winged Upper Eyelash, and Sculpted Eyebrow).
 */
const AnimeFaceDetails: React.FC<{
  anchors: {
    leftEye: THREE.Vector3;
    rightEye: THREE.Vector3;
    leftCheekBlush: THREE.Vector3;
    rightCheekBlush: THREE.Vector3;
    mouthCenter: THREE.Vector3;
  };
  appearance: CharacterAppearance;
  isTranslucent: boolean;
}> = ({ anchors, appearance, isTranslucent }) => {
  if (!appearance.animeStyleEnabled) return null;

  const eyeRadius = 0.0125 * appearance.eyeSize;
  const irisRadius = eyeRadius * 0.72 * appearance.pupilScale;
  const pupilRadius = irisRadius * 0.54;
  const tiltRad = THREE.MathUtils.degToRad(appearance.eyeTilt);
  const browTiltRad = THREE.MathUtils.degToRad(appearance.browAngle);
  const opacityMult = isTranslucent ? 0.5 : 1.0;

  const renderSingleEye = (pos: THREE.Vector3, sideSign: 1 | -1) => {
    const yawAngle = sideSign * 0.24; // Face slightly outward along facial curvature
    return (
      <group
        key={`anime-eye-${sideSign}`}
        position={[pos.x, pos.y, pos.z - 0.0015]}
        rotation={[0, yawAngle, sideSign * tiltRad]}
      >
        {/* White Sclera Dome */}
        <mesh scale={[1.18, 0.95, 0.42]}>
          <sphereGeometry args={[eyeRadius, 24, 20]} />
          <meshStandardMaterial
            color="#f8fafc"
            roughness={0.2}
            transparent={isTranslucent}
            opacity={opacityMult}
          />
        </mesh>

        {/* Vibrant Anime Iris Disc */}
        <mesh
          position={[0, 0, eyeRadius * 0.34]}
          scale={[1.0, 1.05, 0.28]}
        >
          <sphereGeometry args={[irisRadius, 24, 20]} />
          <meshStandardMaterial
            color={appearance.eyeColorHex}
            emissive={appearance.eyeColorHex}
            emissiveIntensity={0.28}
            roughness={0.14}
            metalness={0.1}
            transparent={isTranslucent}
            opacity={opacityMult}
          />
        </mesh>

        {/* Deep Dark Pupil Core */}
        <mesh
          position={[0, -0.0005, eyeRadius * 0.42]}
          scale={[0.92, 1.02, 0.22]}
        >
          <sphereGeometry args={[pupilRadius, 20, 16]} />
          <meshBasicMaterial color="#090d16" />
        </mesh>

        {/* Primary & Secondary Anime Starlight Catchlights */}
        {appearance.sparkleIntensity > 0.05 && (
          <>
            <mesh
              position={[
                sideSign * irisRadius * 0.36,
                irisRadius * 0.36,
                eyeRadius * 0.48,
              ]}
              scale={[
                appearance.sparkleIntensity,
                appearance.sparkleIntensity,
                0.3,
              ]}
            >
              <sphereGeometry args={[irisRadius * 0.27, 14, 14]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh
              position={[
                -sideSign * irisRadius * 0.32,
                -irisRadius * 0.34,
                eyeRadius * 0.47,
              ]}
              scale={[
                appearance.sparkleIntensity * 0.85,
                appearance.sparkleIntensity * 0.85,
                0.3,
              ]}
            >
              <sphereGeometry args={[irisRadius * 0.16, 12, 12]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </>
        )}

        {/* Winged Upper Anime Eyelash Frame */}
        <mesh
          position={[0, eyeRadius * 0.35, eyeRadius * 0.25]}
          rotation={[0.2, 0, -sideSign * 0.08]}
          scale={[
            1.28,
            0.35 * appearance.eyelashThickness,
            0.48,
          ]}
        >
          <torusGeometry
            args={[eyeRadius * 0.96, 0.0024 * appearance.eyelashThickness, 10, 24, Math.PI * 0.92]}
          />
          <meshStandardMaterial color="#141824" roughness={0.4} />
        </mesh>

        {/* Expressive Anime Eyebrow */}
        <mesh
          position={[
            0,
            eyeRadius * 1.42 + appearance.browHeight * 0.012,
            eyeRadius * 0.2,
          ]}
          rotation={[0.15, 0, sideSign * browTiltRad - sideSign * tiltRad]}
          scale={[1.35, 0.28, 0.35]}
        >
          <torusGeometry
            args={[eyeRadius * 0.98, 0.0019, 8, 20, Math.PI * 0.82]}
          />
          <meshStandardMaterial
            color={appearance.hairColorHex}
            roughness={0.45}
          />
        </mesh>
      </group>
    );
  };

  const blushOpacity =
    (appearance.expression === 'shyBlush'
      ? Math.max(0.75, appearance.blushIntensity)
      : appearance.blushIntensity) *
    0.52 *
    opacityMult;

  return (
    <group name="anime-cas-facial-details">
      {renderSingleEye(anchors.leftEye, 1)}
      {renderSingleEye(anchors.rightEye, -1)}

      {/* Soft Anime Cheek Blush Cushions */}
      {blushOpacity > 0.02 && (
        <>
          <mesh
            position={[
              anchors.leftCheekBlush.x,
              anchors.leftCheekBlush.y,
              anchors.leftCheekBlush.z + 0.0008,
            ]}
            rotation={[0, 0.42, 0]}
            scale={[1.35, 0.72, 0.32]}
          >
            <sphereGeometry args={[0.011, 16, 14]} />
            <meshBasicMaterial
              color={appearance.blushColorHex}
              transparent
              opacity={blushOpacity}
              depthWrite={false}
            />
          </mesh>
          <mesh
            position={[
              anchors.rightCheekBlush.x,
              anchors.rightCheekBlush.y,
              anchors.rightCheekBlush.z + 0.0008,
            ]}
            rotation={[0, -0.42, 0]}
            scale={[1.35, 0.72, 0.32]}
          >
            <sphereGeometry args={[0.011, 16, 14]} />
            <meshBasicMaterial
              color={appearance.blushColorHex}
              transparent
              opacity={blushOpacity}
              depthWrite={false}
            />
          </mesh>
        </>
      )}

      {/* Subtle Lip Tint Highlight */}
      <mesh
        position={[
          anchors.mouthCenter.x,
          anchors.mouthCenter.y + 0.001,
          anchors.mouthCenter.z + 0.002,
        ]}
        scale={[
          1.2 * appearance.mouthWidth,
          0.55 * appearance.lipFullness,
          0.4,
        ]}
      >
        <sphereGeometry args={[0.0085, 16, 12]} />
        <meshStandardMaterial
          color={appearance.lipColorHex}
          roughness={0.28}
          transparent
          opacity={0.72 * opacityMult}
        />
      </mesh>
    </group>
  );
};

export const ParametricBody: React.FC = () => {
  const gender = useAtelierStore((s) => s.gender);
  const measurements = useAtelierStore((s) => s.measurements);
  const appearance = useAtelierStore((s) => s.appearance);
  const surfaceFinish = useAtelierStore((s) => s.glassSettings.surfaceFinish);
  const theme = useAtelierStore((s) => s.glassSettings.theme);

  const {
    torsoGeometry,
    headGeometry,
    hairGeometry,
    eyeAnchors,
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

    // 1. 96-Ring High-Resolution Lofted Torso, Pelvis, Trapezius & Neck
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

    // 2. Sims-4 / Anime CAS Sculpted Head & Face
    const neckEval = torsoEval.evalAtY(L.yJaw - 0.014).radii;
    const { headGeo, eyeAnchors: anchors } = buildSculptedHeadAndFaceGeometry(
      L,
      measurements.head * CM_TO_M,
      neckEval.a,
      (neckEval.bFront + neckEval.bBack) * 0.5,
      neckEval.centerZ,
      appearance
    );

    // 3. 3D Procedural Anime Hairstyle Mesh
    const hairGeo = appearance.animeStyleEnabled
      ? buildAnimeHairstyleGeometry(
          appearance.hairstyle,
          L,
          anchors.headWidthA,
          anchors.headDepthB,
          anchors.centerZHead,
          appearance
        )
      : null;

    // 4. 42-Ring Multi-Segment Lofted Arms
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

    // 5. Articulated 5-Finger Sculpted Hands
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

    // 6. 52-Ring Multi-Segment Lofted Legs
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

    // 7. Sculpted Anatomical Feet with 5 Toes
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
      hairGeometry: hairGeo,
      eyeAnchors: anchors,
      leftArmGeometry: leftArmGeo,
      rightArmGeometry: rightArmGeo,
      leftHandGeometry: leftHandGeo,
      rightHandGeometry: rightHandGeo,
      leftLegGeometry: leftLegGeo,
      rightLegGeometry: rightLegGeo,
      leftFootGeometry: leftFootGeo,
      rightFootGeometry: rightFootGeo,
    };
  }, [measurements, gender, appearance]);

  // Skin / Body surface shader material
  const skinMaterial = useMemo(() => {
    const isLight = theme === 'light';
    const baseColor = appearance.animeStyleEnabled
      ? appearance.skinToneHex
      : isLight
      ? '#cfd6e2'
      : '#c2cce0';

    if (surfaceFinish === 'clay') {
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.78,
        metalness: 0.02,
        clearcoat: 0.06,
        sheen: 0.3,
        sheenRoughness: 0.75,
        side: THREE.DoubleSide,
      });
    }
    if (surfaceFinish === 'translucent') {
      return new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.22,
        metalness: 0.08,
        clearcoat: 0.5,
        clearcoatRoughness: 0.2,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    }
    // Default: 'satin' (Anime Subsurface Satin Skin)
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: 0.32,
      metalness: 0.04,
      clearcoat: 0.36,
      clearcoatRoughness: 0.26,
      sheen: 0.35,
      sheenColor: new THREE.Color('#ffe4e6'),
      sheenRoughness: 0.45,
      side: THREE.DoubleSide,
    });
  }, [surfaceFinish, theme, appearance.animeStyleEnabled, appearance.skinToneHex]);

  // Anime Hair shader with anisotropic-like sheen highlight
  const hairMaterial = useMemo(() => {
    const isTranslucent = surfaceFinish === 'translucent';
    return new THREE.MeshPhysicalMaterial({
      color: appearance.hairColorHex,
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18,
      sheen: 0.75,
      sheenColor: new THREE.Color(appearance.hairHighlightHex),
      sheenRoughness: 0.25,
      transparent: isTranslucent,
      opacity: isTranslucent ? 0.45 : 1.0,
      depthWrite: !isTranslucent,
      side: THREE.DoubleSide,
    });
  }, [
    appearance.hairColorHex,
    appearance.hairHighlightHex,
    surfaceFinish,
  ]);

  return (
    <group name="parametric-mannequin-group">
      {/* 96-Ring Lofted Torso, Pelvis, Trapezius & Neck */}
      <mesh
        geometry={torsoGeometry}
        material={skinMaterial}
        castShadow
        receiveShadow
      />

      {/* Sims-4 / Anime CAS Sculpted Head & Face */}
      <mesh
        geometry={headGeometry}
        material={skinMaterial}
        castShadow
        receiveShadow
      />

      {/* Expressive 3D Anime Eyes, Sparkles, Winged Eyelashes, Brows, Blush & Lip Tint */}
      <AnimeFaceDetails
        anchors={eyeAnchors}
        appearance={appearance}
        isTranslucent={surfaceFinish === 'translucent'}
      />

      {/* Procedural 3D Anime Hairstyle (Twintails, Hime, Bob, Spiky Shonen, Ponytail, Wolf Cut, Odango, Ahoge) */}
      {hairGeometry && (
        <mesh
          geometry={hairGeometry}
          material={hairMaterial}
          castShadow
          receiveShadow
        />
      )}

      {/* Left & Right Multi-Segment Lofted Arms */}
      <mesh
        geometry={leftArmGeometry}
        material={skinMaterial}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={rightArmGeometry}
        material={skinMaterial}
        castShadow
        receiveShadow
      />

      {/* Left & Right Articulated 5-Finger Sculpted Hands */}
      <mesh
        geometry={leftHandGeometry}
        material={skinMaterial}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={rightHandGeometry}
        material={skinMaterial}
        castShadow
        receiveShadow
      />

      {/* Left & Right Multi-Segment Lofted Legs */}
      <mesh
        geometry={leftLegGeometry}
        material={skinMaterial}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={rightLegGeometry}
        material={skinMaterial}
        castShadow
        receiveShadow
      />

      {/* Left & Right Sculpted Feet with 5 Toes */}
      <mesh
        geometry={leftFootGeometry}
        material={skinMaterial}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={rightFootGeometry}
        material={skinMaterial}
        castShadow
        receiveShadow
      />
    </group>
  );
};
