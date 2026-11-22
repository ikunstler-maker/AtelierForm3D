import * as THREE from 'three';
import { Gender, MeasurementKey, MeasurementsRecord } from '../data/measurementsSchema';

export const CM_TO_M = 0.01;
export const OVERLAY_OFFSET_M = 0.0022; // +2.2mm surface offset

export interface SuperEllipseRadii {
  a: number;      // Lateral half-width (X semi-axis in meters)
  bFront: number; // Anterior half-depth (+Z semi-axis in meters)
  bBack: number;  // Posterior half-depth (-Z semi-axis in meters)
  n: number;      // Base super-ellipse exponent
  centerZ: number;// Sagittal spinal curve offset (+Z lordosis / -Z kyphosis in meters)
}

export interface AnatomicalDetailProfile {
  gender: Gender;
  yNormTorso: number;
  yNormHead: number;
  bustMask: number;
  bustProjectionM: number;
  underbustIndent: number;
  ribcageMask: number;
  navelMask: number;
  abdomenLineaAlba: number;
  iliacObliqueMask: number;
  gluteMask: number;
  gluteProjectionM: number;
  glutealFoldMask: number;
  scapulaMask: number;
  spineGrooveM: number;
  clavicleMask: number;
  trapeziusMask: number;
  crotchSaddleMask: number;
  jawMask: number;
  noseBrowMask: number;
  occiputMask: number;
}

export interface AnatomicalLandmarks {
  gender: Gender;
  yFloor: number;
  yAnkle: number;
  yCalf: number;
  yKnee: number;
  yMidThigh: number;
  yThigh: number;
  yCrotch: number;
  yHip: number;
  yHighHip: number;
  yWaist: number;
  yUnderbust: number;
  yChest: number;
  yUpperChest: number;
  yArmpit: number;
  yShoulder: number;
  yCervicale: number;
  yNeckMid: number;
  yNeckCut: number;
  yJaw: number;
  yHeadMax: number;
  yCrown: number;

  shoulderHalfSpan: number;
  neckHalfWidth: number;
  hipStanceHalfX: number;
  kneeStanceHalfX: number;
  ankleStanceHalfX: number;

  armRootL: THREE.Vector3;
  armShoulderL: THREE.Vector3;
  armpitL: THREE.Vector3;
  armDeltoidEndL: THREE.Vector3;
  armBicepL: THREE.Vector3;
  armElbowL: THREE.Vector3;
  armForearmL: THREE.Vector3;
  armWristL: THREE.Vector3;
  handPalmL: THREE.Vector3;
  handKnuckleL: THREE.Vector3;
  handTipL: THREE.Vector3;

  legPelvisRootL: THREE.Vector3;
  legTopL: THREE.Vector3;
  legThighL: THREE.Vector3;
  legMidThighL: THREE.Vector3;
  legKneeL: THREE.Vector3;
  legCalfL: THREE.Vector3;
  legLowerShinL: THREE.Vector3;
  legAnkleL: THREE.Vector3;
}

export interface OverlayGeometryData {
  key: MeasurementKey;
  type: 'ring' | 'line' | 'height';
  points: THREE.Vector3[];
  closed: boolean;
  labelPosition: THREE.Vector3;
}

/**
 * Exact inverse of Ramanujan's second ellipse perimeter approximation:
 * P(a, b) ≈ π * [ 3(a + b) - sqrt((3a + b)(a + 3b)) ] = C
 */
export function circumferenceToEllipseAxes(
  circumferenceM: number,
  aspectRatioRho: number
): { a: number; b: number } {
  const rho = Math.max(0.35, Math.min(3.0, aspectRatioRho));
  const ramanujanFactor =
    Math.PI * (3 * (rho + 1) - Math.sqrt((3 * rho + 1) * (rho + 3)));
  const b = circumferenceM / ramanujanFactor;
  const a = rho * b;
  return { a, b };
}

/**
 * Smooth monotonic cubic Hermite interpolation (Fritsch-Carlson) over sorted 1D stations.
 */
export function createMonotoneHermiteInterpolator(
  xs: number[],
  ys: number[]
): (x: number) => number {
  const n = xs.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => ys[0];

  const dxs: number[] = [];
  const dys: number[] = [];
  const slopes: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = Math.max(1e-6, xs[i + 1] - xs[i]);
    const dy = ys[i + 1] - ys[i];
    dxs.push(dx);
    dys.push(dy);
    slopes.push(dy / dx);
  }

  const tangents: number[] = new Array(n).fill(0);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    const m0 = slopes[i - 1];
    const m1 = slopes[i];
    if (m0 * m1 <= 0) {
      tangents[i] = 0;
    } else {
      const dx0 = dxs[i - 1];
      const dx1 = dxs[i];
      const common = dx0 + dx1;
      tangents[i] = (3 * common) / ((common + dx1) / m0 + (common + dx0) / m1);
    }
  }

  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];

    let low = 0;
    let high = n - 2;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (x < xs[mid]) {
        high = mid - 1;
      } else if (x > xs[mid + 1]) {
        low = mid + 1;
      } else {
        low = mid;
        break;
      }
    }

    const i = Math.max(0, Math.min(n - 2, low));
    const h = dxs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    return (
      h00 * ys[i] +
      h10 * h * tangents[i] +
      h01 * ys[i + 1] +
      h11 * h * tangents[i + 1]
    );
  };
}

/**
 * Evaluates a 3D surface point on an anatomical torso/neck/head cross-section at angle theta ∈ [0, 2π),
 * sculpted to match the ACON / Clip Studio Anime Body Reference (`w1536-wm.webp`):
 * - Crisp teardrop breast mounds with defined under-bust crease and sternum cleavage
 * - Slender hourglass ribcage & waist with subtle linea alba, navel, and inguinal V-taper
 * - Deep spinal furrow flanked by erector spinae & defined scapular planes
 * - Lifted bilateral gluteal hemispheres with crisp infragluteal fold
 */
export function sampleCrossSectionPoint(
  radii: SuperEllipseRadii,
  theta: number,
  y: number,
  radialOffsetM = 0,
  detail?: AnatomicalDetailProfile
): THREE.Vector3 {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const absCos = Math.abs(cosT);
  const absSin = Math.abs(sinT);
  const power = 2 / Math.max(1.65, Math.min(3.1, radii.n));

  const signedPow = (val: number, p: number) =>
    Math.sign(val) * Math.pow(Math.abs(val), p);

  let x = (radii.a + radialOffsetM) * signedPow(cosT, power);
  const bRadius = sinT >= 0 ? radii.bFront : radii.bBack;
  let z = (bRadius + radialOffsetM) * signedPow(sinT, power);
  let yOffset = 0;

  if (detail) {
    const isFemale = detail.gender === 'female';

    // 1. ANTERIOR BREAST / PECTORAL ANATOMY (sinT > 0)
    if (detail.bustMask > 0.001 && sinT > 0) {
      // Distinct left/right breast hemispheres centered at |cosT| ≈ 0.44
      const lobeCenter = isFemale ? 0.44 : 0.48;
      const lobeSigma = isFemale ? 0.23 : 0.3;
      const lobeGaussian = Math.exp(-Math.pow((absCos - lobeCenter) / lobeSigma, 2));
      const frontEnvelope = Math.pow(sinT, 1.2);

      // Crisp sternum cleavage valley at center-front (cosT = 0)
      const sternumValley =
        Math.exp(-Math.pow(absCos / (isFemale ? 0.15 : 0.12), 2)) *
        Math.pow(sinT, 2.6);

      const dzBust =
        detail.bustMask *
        detail.bustProjectionM *
        frontEnvelope *
        (1.22 * lobeGaussian +
          (isFemale ? 0.08 : 0.22) -
          (isFemale ? 0.52 : 0.26) * sternumValley);

      z += dzBust;

      // Natural outward lateral breast curve (gives the 3/4 view breast silhouette seen in reference)
      if (isFemale) {
        x +=
          Math.sign(cosT) *
          detail.bustMask *
          detail.bustProjectionM *
          0.32 *
          lobeGaussian *
          frontEnvelope;
      }
    }

    // 2. INFRAMAMMARY FOLD (crisp crease under breasts so cel-shader casts crescent shadow)
    if (detail.underbustIndent > 0.001 && sinT > 0.15) {
      const underLobe = Math.exp(-Math.pow((absCos - 0.44) / 0.25, 2));
      z -=
        detail.underbustIndent *
        Math.pow(sinT, 1.5) *
        (0.35 + 0.85 * underLobe);
    }

    // 3. RIBCAGE ARCH, LINEA ALBA & NAVEL (UMBILICUS)
    if (detail.abdomenLineaAlba > 0.001 && sinT > 0.45) {
      const centerGroove = Math.exp(-Math.pow(absCos / 0.075, 2));
      const semilunarisGroove = Math.exp(-Math.pow((absCos - 0.38) / 0.08, 2));
      z -=
        detail.abdomenLineaAlba *
        Math.pow(sinT, 2.8) *
        (centerGroove + 0.5 * semilunarisGroove);
    }
    if (detail.navelMask > 0.001 && sinT > 0.82) {
      const navelSpot = Math.exp(-Math.pow(absCos / 0.055, 2));
      z -= detail.navelMask * 0.0085 * navelSpot;
    }

    // 4. ILIAC CREST & PELVIC V-TAPER
    if (detail.iliacObliqueMask > 0.001) {
      const obliqueZone = Math.exp(-Math.pow((absCos - 0.86) / 0.18, 2));
      x += Math.sign(cosT) * detail.iliacObliqueMask * 0.005 * obliqueZone;
    }

    // 5. POSTERIOR GLUTEAL HEMISPHERES & INTERGLUTEAL CLEFT (sinT < 0)
    if (detail.gluteMask > 0.001 && sinT < 0) {
      const backSin = -sinT;
      const gluteLobe = Math.exp(-Math.pow((absCos - 0.41) / 0.27, 2));
      const natalCleft =
        Math.exp(-Math.pow(absCos / 0.105, 2)) * Math.pow(backSin, 3.2);

      const dzGlute =
        detail.gluteMask *
        detail.gluteProjectionM *
        Math.pow(backSin, 1.12) *
        (1.16 * gluteLobe + 0.18 - 0.78 * natalCleft);

      z -= dzGlute;
    }

    // 6. INFRAGLUTEAL FOLD (creased indentation directly below glutes)
    if (detail.glutealFoldMask > 0.001 && sinT < -0.22) {
      const foldLobe = Math.exp(-Math.pow((absCos - 0.41) / 0.28, 2));
      z += detail.glutealFoldMask * 0.0125 * Math.pow(-sinT, 1.45) * foldLobe;
    }

    // 7. SPINAL FURROW (ERECTOR SPINAE) & SCAPULAE (UPPER BACK)
    if (detail.spineGrooveM > 0.0002 && sinT < -0.35) {
      const backSin = -sinT;
      const spineFurrow =
        Math.exp(-Math.pow(absCos / 0.09, 2)) * Math.pow(backSin, 3.2);
      const erectorRidge =
        Math.exp(-Math.pow((absCos - 0.23) / 0.11, 2)) * Math.pow(backSin, 2.0);
      z += detail.spineGrooveM * (1.25 * spineFurrow - 0.45 * erectorRidge);
    }

    if (detail.scapulaMask > 0.001 && sinT < -0.15) {
      const backSin = -sinT;
      const scapulaLobe = Math.exp(-Math.pow((absCos - 0.46) / 0.24, 2));
      z -= detail.scapulaMask * 0.0135 * Math.pow(backSin, 1.4) * scapulaLobe;
    }

    // 8. CLAVICLE (COLLARBONE) & SUPRASTERNAL NOTCH
    if (detail.clavicleMask > 0.001 && sinT > 0.22) {
      const clavicleBar = Math.exp(-Math.pow((absCos - 0.5) / 0.3, 2));
      const jugularNotch = Math.exp(-Math.pow(absCos / 0.12, 2));
      z +=
        detail.clavicleMask *
        0.0075 *
        Math.pow(sinT, 1.5) *
        (clavicleBar - 0.85 * jugularNotch);
    }

    // 9. PELVIC SADDLE & INGUINAL V-ARCH (at bottom of pelvis near yCrotch)
    if (detail.crotchSaddleMask > 0.001 && radialOffsetM === 0) {
      const lateralArch = Math.pow(absCos, 1.45);
      yOffset += detail.crotchSaddleMask * 0.044 * lateralArch;
      // Narrow the pubic/perineal wedge cleanly between the thighs
      x *= 1 - detail.crotchSaddleMask * 0.48 * Math.pow(absSin, 1.3);
      const centerPinch =
        Math.exp(-Math.pow(absCos / 0.24, 2)) * Math.pow(absSin, 1.4);
      z *= 1 - detail.crotchSaddleMask * 0.32 * centerPinch;
    }
  }

  return new THREE.Vector3(x, y + yOffset, z + radii.centerZ);
}

/**
 * Computes unified 3D anatomical landmarks from the 50 tailoring parameters.
 */
export function computeAnatomicalLandmarks(
  m: MeasurementsRecord,
  gender: Gender
): AnatomicalLandmarks {
  const isFemale = gender === 'female';
  const yFloor = 0;
  const yCrown = m.totalHeight * CM_TO_M;

  const avgRiseVertM =
    ((m.frontRise * 0.86 + m.backRise * 0.72) * 0.5) * CM_TO_M;
  const yAnkle = Math.max(0.062, Math.min(0.105, m.totalHeight * 0.044 * CM_TO_M));

  const yCrotchRaw =
    (m.crotchHeight * 0.45 + (m.inseamLength + yAnkle * 100) * 0.55) * CM_TO_M;
  const yCrotch = Math.max(0.55, Math.min(yCrown * 0.535, yCrotchRaw));

  const yWaistFromOutseam = yAnkle + m.outseamFromWaist * CM_TO_M * 0.96;
  const yWaistFromRise = yCrotch + avgRiseVertM;
  const yWaistRaw =
    m.waistHeight * CM_TO_M * 0.4 +
    yWaistFromOutseam * 0.35 +
    yWaistFromRise * 0.25;
  const yWaist = Math.max(yCrotch + 0.165, Math.min(yCrown * 0.71, yWaistRaw));

  const yHighHipFromOutseam = yAnkle + m.outseamFromHighHip * CM_TO_M * 0.96;
  const yHighHip = Math.max(
    yCrotch + 0.095,
    Math.min(
      yWaist - 0.04,
      m.highHipHeight * CM_TO_M * 0.5 + yHighHipFromOutseam * 0.5
    )
  );
  const yHip = Math.max(
    yCrotch + 0.038,
    Math.min(yHighHip - 0.035, m.hipHeight * CM_TO_M)
  );

  const yKneeFromWaist = yWaist - m.waistToKneeLength * CM_TO_M * 0.97;
  const yKnee = Math.max(
    yAnkle + 0.22,
    Math.min(yCrotch - 0.16, m.kneeHeight * CM_TO_M * 0.5 + yKneeFromWaist * 0.5)
  );

  const yThigh = yCrotch - 0.032;
  const yMidThigh = (yThigh + yKnee) * 0.5;
  const yCalf = yAnkle + (yKnee - yAnkle) * 0.65;

  const torsoVertFromBack = m.backWaistLength * CM_TO_M * 0.93;
  const torsoVertFromFront = m.frontWaistLength * CM_TO_M * 0.89;
  const torsoVertFromLoop = m.torsoLoop * CM_TO_M * 0.46 - (yWaist - yCrotch);

  const yCervicaleRaw =
    m.cervicaleHeight * CM_TO_M * 0.4 +
    (yWaist +
      (torsoVertFromBack * 0.55 +
        torsoVertFromFront * 0.3 +
        torsoVertFromLoop * 0.15)) *
      0.6;
  const yCervicale = Math.max(
    yWaist + 0.28,
    Math.min(yCrown - 0.19, yCervicaleRaw)
  );

  const shoulderDropFromC7 = Math.max(
    0.042,
    Math.min(0.085, (m.cervicaleHeight - m.shoulderHeight) * CM_TO_M)
  );
  const yShoulder = yCervicale - shoulderDropFromC7;

  const yArmpit = Math.max(
    yWaist + 0.13,
    Math.min(yShoulder - 0.055, yWaist + m.sideTorsoLength * CM_TO_M * 0.96)
  );

  const torsoSpan = yCervicale - yWaist;
  const yChestRatio = Math.max(
    0.29,
    Math.min(
      0.6,
      (m.chestHeight - m.waistHeight) /
        Math.max(20, m.cervicaleHeight - m.waistHeight)
    )
  );
  const yChest = yWaist + torsoSpan * yChestRatio;
  const yUnderbust = Math.max(
    yWaist + 0.042,
    Math.min(
      yChest - 0.042,
      yChest - (m.chestHeight - m.underbustHeight) * CM_TO_M
    )
  );
  const yUpperChest = Math.min(
    yShoulder - 0.025,
    Math.max(yChest + 0.048, yArmpit + 0.014)
  );

  const headSpan = Math.max(0.19, yCrown - yCervicale);
  const yNeckMid = yCervicale + headSpan * 0.18;
  // Clean collar cut plane for Headless reference mode
  const yNeckCut = yCervicale + headSpan * 0.24;
  const yJaw = yCervicale + headSpan * 0.35;
  const yHeadMax = yCervicale + headSpan * 0.69;

  const neckRadii = circumferenceToEllipseAxes(m.neck * CM_TO_M, 1.04);
  const neckHalfWidth = neckRadii.a;
  const shoulderHalfFromWidth = m.shoulderWidth * CM_TO_M * 0.49;
  const shoulderHalfFromSeam =
    neckHalfWidth + m.singleShoulderLength * CM_TO_M * 0.92;
  const shoulderHalfSpan =
    shoulderHalfFromWidth * 0.62 + shoulderHalfFromSeam * 0.38;

  // Hip, knee & ankle anime stance X (with subtle natural thigh gap like w1536-wm.webp)
  const hipRadii = circumferenceToEllipseAxes(
    m.hip * CM_TO_M,
    isFemale ? 1.42 : 1.32
  );
  const thighRadii = circumferenceToEllipseAxes(m.thigh * CM_TO_M, 0.93);
  const hipStanceHalfX = Math.max(
    thighRadii.a * (isFemale ? 1.05 : 1.01),
    hipRadii.a * (isFemale ? 0.54 : 0.54)
  );
  const kneeStanceHalfX = hipStanceHalfX * (isFemale ? 0.84 : 0.92);
  const ankleStanceHalfX = hipStanceHalfX * (isFemale ? 0.76 : 0.88);

  const armAbductionRad = THREE.MathUtils.degToRad(isFemale ? 16.0 : 17.5);
  const elbowFlexForwardRad = THREE.MathUtils.degToRad(10.5);
  const carryingAngleRad = THREE.MathUtils.degToRad(isFemale ? 20.0 : 19.0);

  const upperArmLenM = Math.max(
    0.22,
    (m.shoulderToElbow * 0.65 +
      (m.sleeveFromShoulder - m.sleeveFromArmpit + 18) * 0.35) *
      CM_TO_M
  );
  const totalSleeveM = Math.max(
    upperArmLenM + 0.18,
    (m.sleeveFromShoulder * 0.55 +
      (m.sleeveFromNeck - m.singleShoulderLength - m.neck * 0.16) * 0.2 +
      (m.sleeveFromArmpit + (yShoulder - yArmpit) * 100) * 0.25) *
      CM_TO_M
  );
  const forearmLenM = Math.max(0.18, totalSleeveM - upperArmLenM);

  const armShoulderL = new THREE.Vector3(shoulderHalfSpan * 0.94, yShoulder, -0.012);
  const armRootL = new THREE.Vector3(
    shoulderHalfSpan * 0.72,
    yShoulder + 0.008,
    -0.01
  );
  const armpitL = new THREE.Vector3(
    shoulderHalfSpan * 0.76,
    yArmpit,
    0.004
  );

  const upperDir = new THREE.Vector3(
    Math.sin(armAbductionRad),
    -Math.cos(armAbductionRad),
    -0.035
  ).normalize();

  const armElbowL = armShoulderL
    .clone()
    .addScaledVector(upperDir, upperArmLenM);
  const armDeltoidEndL = armShoulderL.clone().lerp(armElbowL, 0.26);
  const armBicepL = armShoulderL.clone().lerp(armElbowL, 0.52);

  const lowerDir = new THREE.Vector3(
    Math.sin(carryingAngleRad),
    -Math.cos(carryingAngleRad) * Math.cos(elbowFlexForwardRad),
    Math.sin(elbowFlexForwardRad)
  ).normalize();

  const armWristL = armElbowL.clone().addScaledVector(lowerDir, forearmLenM);
  const armForearmL = armElbowL.clone().lerp(armWristL, 0.34);

  const handLenM = m.handLength * CM_TO_M;
  const handDir = new THREE.Vector3(
    Math.sin(carryingAngleRad * 0.75),
    -Math.cos(carryingAngleRad * 0.75) * Math.cos(elbowFlexForwardRad * 1.15),
    Math.sin(elbowFlexForwardRad * 1.15)
  ).normalize();

  const handPalmL = armWristL.clone().addScaledVector(handDir, handLenM * 0.28);
  const handKnuckleL = armWristL
    .clone()
    .addScaledVector(handDir, handLenM * 0.54);
  const handTipL = armWristL.clone().addScaledVector(handDir, handLenM);

  const legPelvisRootL = new THREE.Vector3(
    hipStanceHalfX * 0.94,
    yHip - 0.004,
    -0.006
  );
  const legTopL = new THREE.Vector3(hipStanceHalfX, yCrotch + 0.004, -0.002);
  const legThighL = new THREE.Vector3(
    THREE.MathUtils.lerp(hipStanceHalfX, kneeStanceHalfX, 0.16),
    yThigh,
    0.004
  );
  const legMidThighL = new THREE.Vector3(
    THREE.MathUtils.lerp(hipStanceHalfX, kneeStanceHalfX, 0.52),
    yMidThigh,
    0.006
  );
  const legKneeL = new THREE.Vector3(kneeStanceHalfX, yKnee, 0.002);
  const legCalfL = new THREE.Vector3(
    THREE.MathUtils.lerp(kneeStanceHalfX, ankleStanceHalfX, 0.38),
    yCalf,
    -0.011
  );
  const legLowerShinL = new THREE.Vector3(
    THREE.MathUtils.lerp(kneeStanceHalfX, ankleStanceHalfX, 0.75),
    THREE.MathUtils.lerp(yCalf, yAnkle, 0.62),
    -0.007
  );
  const legAnkleL = new THREE.Vector3(ankleStanceHalfX, yAnkle, -0.006);

  return {
    gender,
    yFloor,
    yAnkle,
    yCalf,
    yKnee,
    yMidThigh,
    yThigh,
    yCrotch,
    yHip,
    yHighHip,
    yWaist,
    yUnderbust,
    yChest,
    yUpperChest,
    yArmpit,
    yShoulder,
    yCervicale,
    yNeckMid,
    yNeckCut,
    yJaw,
    yHeadMax,
    yCrown,
    shoulderHalfSpan,
    neckHalfWidth,
    hipStanceHalfX,
    kneeStanceHalfX,
    ankleStanceHalfX,
    armRootL,
    armShoulderL,
    armpitL,
    armDeltoidEndL,
    armBicepL,
    armElbowL,
    armForearmL,
    armWristL,
    handPalmL,
    handKnuckleL,
    handTipL,
    legPelvisRootL,
    legTopL,
    legThighL,
    legMidThighL,
    legKneeL,
    legCalfL,
    legLowerShinL,
    legAnkleL,
  };
}

export interface TorsoCrossSectionEvaluator {
  landmarks: AnatomicalLandmarks;
  evalAtY: (y: number) => {
    radii: SuperEllipseRadii;
    detail: AnatomicalDetailProfile;
  };
  sampleSurfacePoint: (y: number, theta: number, radialOffsetM?: number) => THREE.Vector3;
  sampleClosedRing: (y: number, segments?: number, radialOffsetM?: number) => THREE.Vector3[];
}

/**
 * Builds a continuous high-definition anatomical spline evaluator for the pelvis, torso,
 * shoulders, trapezius, neck, and sculpted head from yCrotch up to yCrown.
 */
export function createTorsoEvaluator(
  m: MeasurementsRecord,
  gender: Gender,
  landmarks?: AnatomicalLandmarks
): TorsoCrossSectionEvaluator {
  const L = landmarks ?? computeAnatomicalLandmarks(m, gender);
  const isFemale = gender === 'female';

  const hipAxes = circumferenceToEllipseAxes(
    m.hip * CM_TO_M,
    isFemale ? 1.42 : 1.32
  );
  const highHipAxes = circumferenceToEllipseAxes(
    m.highHip * CM_TO_M,
    isFemale ? 1.39 : 1.31
  );
  const waistAxes = circumferenceToEllipseAxes(
    m.waist * CM_TO_M,
    isFemale ? 1.35 : 1.29
  );
  const underbustAxes = circumferenceToEllipseAxes(
    m.underbust * CM_TO_M,
    isFemale ? 1.38 : 1.34
  );
  const chestAxes = circumferenceToEllipseAxes(
    m.chest * CM_TO_M,
    isFemale ? 1.35 : 1.39
  );
  const upperChestAxes = circumferenceToEllipseAxes(
    m.upperChest * CM_TO_M,
    isFemale ? 1.48 : 1.52
  );
  const neckAxes = circumferenceToEllipseAxes(m.neck * CM_TO_M, 1.03);
  const headAxes = circumferenceToEllipseAxes(m.head * CM_TO_M, 0.81);

  const acrossRatio =
    ((m.acrossFrontWidth + m.acrossBackWidth) * CM_TO_M) /
    Math.max(0.5, upperChestAxes.a * 4);
  const upperChestWidthAdjusted =
    upperChestAxes.a * (0.65 + 0.35 * acrossRatio);

  const frontBackChestBias =
    (m.acrossFrontWidth - m.acrossBackWidth) /
    Math.max(30, m.acrossFrontWidth + m.acrossBackWidth);

  const riseRatio = m.backRise / Math.max(20, m.frontRise + m.backRise);
  const gluteDepthBoost = Math.max(0, (riseRatio - 0.52) * 0.14);
  const frontRiseBoost = Math.max(0, (0.48 - riseRatio) * 0.1);

  const bustDeltaM = Math.max(0, (m.chest - m.underbust) * CM_TO_M);
  const bustProjectionM = isFemale
    ? Math.min(0.062, 0.025 + bustDeltaM * 0.21)
    : Math.min(0.024, 0.008 + bustDeltaM * 0.08);

  const hipWaistDeltaM = Math.max(0, (m.hip - m.waist) * CM_TO_M);
  const gluteProjectionM = isFemale
    ? Math.min(0.056, 0.025 + hipWaistDeltaM * 0.085 + gluteDepthBoost)
    : Math.min(0.038, 0.016 + hipWaistDeltaM * 0.06 + gluteDepthBoost);

  const yTrapeziusMid = (L.yShoulder + L.yCervicale) * 0.5;
  const yBrow = L.yJaw + (L.yHeadMax - L.yJaw) * 0.55;

  const stations = [
    {
      y: L.yCrotch,
      a: hipAxes.a * 0.78,
      bF: hipAxes.b * 0.64 + frontRiseBoost,
      bB: hipAxes.b * 0.72 + gluteDepthBoost * 0.6,
      n: 2.1,
      cZ: -0.004,
    },
    {
      y: L.yHip,
      a: hipAxes.a,
      bF: hipAxes.b * (isFemale ? 0.88 : 0.93) + frontRiseBoost,
      bB: hipAxes.b * (isFemale ? 1.06 : 1.02) + gluteDepthBoost,
      n: 2.15,
      cZ: -0.011,
    },
    {
      y: L.yHighHip,
      a: highHipAxes.a,
      bF: highHipAxes.b * 0.95,
      bB: highHipAxes.b * 1.02,
      n: 2.14,
      cZ: -0.002,
    },
    {
      y: L.yWaist,
      a: waistAxes.a,
      bF: waistAxes.b * 0.97,
      bB: waistAxes.b * 0.98,
      n: 2.06,
      cZ: 0.01,
    },
    {
      y: L.yUnderbust,
      a: underbustAxes.a,
      bF: underbustAxes.b * 0.96,
      bB: underbustAxes.b * 1.0,
      n: 2.14,
      cZ: 0.004,
    },
    {
      y: L.yChest,
      a: chestAxes.a * (isFemale ? 0.95 : 1.0),
      bF:
        chestAxes.b * (isFemale ? 0.94 : 1.0) +
        frontBackChestBias * 0.025,
      bB:
        chestAxes.b * (isFemale ? 0.96 : 1.0) -
        frontBackChestBias * 0.025,
      n: 2.2,
      cZ: -0.002,
    },
    {
      y: L.yUpperChest,
      a: upperChestWidthAdjusted,
      bF: upperChestAxes.b * 0.93 + frontBackChestBias * 0.02,
      bB: upperChestAxes.b * 1.01 - frontBackChestBias * 0.02,
      n: 2.28,
      cZ: -0.007,
    },
    {
      y: L.yShoulder,
      a: L.shoulderHalfSpan * 0.91,
      bF: upperChestAxes.b * 0.72,
      bB: upperChestAxes.b * 0.82,
      n: 2.32,
      cZ: -0.009,
    },
    {
      y: yTrapeziusMid,
      a: THREE.MathUtils.lerp(L.shoulderHalfSpan * 0.91, neckAxes.a * 1.1, 0.68),
      bF: neckAxes.b * 1.1,
      bB: neckAxes.b * 1.18,
      n: 2.12,
      cZ: -0.005,
    },
    {
      y: L.yCervicale,
      a: neckAxes.a * 1.02,
      bF: neckAxes.b * 1.0,
      bB: neckAxes.b * 1.03,
      n: 2.0,
      cZ: -0.001,
    },
    {
      y: L.yNeckMid,
      a: neckAxes.a * 0.91,
      bF: neckAxes.b * 0.91,
      bB: neckAxes.b * 0.91,
      n: 1.98,
      cZ: 0.005,
    },
    {
      y: L.yJaw - 0.014,
      a: neckAxes.a * 0.92,
      bF: neckAxes.b * 0.94,
      bB: neckAxes.b * 0.94,
      n: 2.0,
      cZ: 0.008,
    },
    {
      y: L.yJaw,
      a: headAxes.a * 0.8,
      bF: headAxes.b * 0.9,
      bB: headAxes.b * 0.84,
      n: 2.06,
      cZ: 0.015,
    },
    {
      y: yBrow,
      a: headAxes.a * 0.97,
      bF: headAxes.b * 0.98,
      bB: headAxes.b * 0.98,
      n: 2.08,
      cZ: 0.011,
    },
    {
      y: L.yHeadMax,
      a: headAxes.a,
      bF: headAxes.b * 0.97,
      bB: headAxes.b * 1.03,
      n: 2.06,
      cZ: 0.005,
    },
    {
      y: L.yCrown - 0.022,
      a: headAxes.a * 0.68,
      bF: headAxes.b * 0.68,
      bB: headAxes.b * 0.7,
      n: 2.0,
      cZ: 0.003,
    },
    {
      y: L.yCrown,
      a: 0.008,
      bF: 0.008,
      bB: 0.008,
      n: 2.0,
      cZ: 0.002,
    },
  ];

  for (let i = 1; i < stations.length; i++) {
    if (stations[i].y <= stations[i - 1].y + 0.003) {
      stations[i].y = stations[i - 1].y + 0.003;
    }
  }

  const ys = stations.map((s) => s.y);
  const interpA = createMonotoneHermiteInterpolator(ys, stations.map((s) => s.a));
  const interpBF = createMonotoneHermiteInterpolator(ys, stations.map((s) => s.bF));
  const interpBB = createMonotoneHermiteInterpolator(ys, stations.map((s) => s.bB));
  const interpN = createMonotoneHermiteInterpolator(ys, stations.map((s) => s.n));
  const interpCZ = createMonotoneHermiteInterpolator(ys, stations.map((s) => s.cZ));

  const gaussianWindow = (y: number, center: number, sigma: number) => {
    const d = (y - center) / Math.max(0.006, sigma);
    return Math.exp(-0.5 * d * d);
  };

  const evalBustMask = (y: number) => {
    if (y < L.yUnderbust - 0.02 || y > L.yShoulder) return 0;
    if (y <= L.yChest) {
      const sigmaLow = Math.max(
        0.02,
        (L.yChest - L.yUnderbust) * (isFemale ? 0.54 : 0.65)
      );
      return gaussianWindow(y, L.yChest, sigmaLow);
    }
    const sigmaHigh = Math.max(
      0.026,
      (L.yUpperChest - L.yChest) * (isFemale ? 0.74 : 0.68)
    );
    return gaussianWindow(y, L.yChest, sigmaHigh);
  };

  const evalAtY = (y: number) => {
    const radii: SuperEllipseRadii = {
      a: Math.max(0.004, interpA(y)),
      bFront: Math.max(0.004, interpBF(y)),
      bBack: Math.max(0.004, interpBB(y)),
      n: interpN(y),
      centerZ: interpCZ(y),
    };

    const yNormTorso = Math.max(
      0,
      Math.min(1, (y - L.yCrotch) / Math.max(0.2, L.yCervicale - L.yCrotch))
    );
    const yNormHead = Math.max(
      0,
      Math.min(1, (y - L.yCervicale) / Math.max(0.15, L.yCrown - L.yCervicale))
    );

    const bustMask = evalBustMask(y);
    const underbustIndent =
      (isFemale ? 0.012 : 0.005) *
      gaussianWindow(y, L.yUnderbust, 0.016);
    const ribcageMask = gaussianWindow(
      y,
      (L.yUnderbust + L.yWaist) * 0.52,
      0.045
    );
    const navelY = L.yWaist - (L.yWaist - L.yHighHip) * 0.32;
    const navelMask = gaussianWindow(y, navelY, 0.011);

    const abdomenLineaAlba =
      y > L.yHighHip && y < L.yChest
        ? (isFemale ? 0.0042 : 0.0058) *
          Math.sin(
            ((y - L.yHighHip) / Math.max(0.1, L.yChest - L.yHighHip)) * Math.PI
          )
        : 0;

    const iliacObliqueMask = gaussianWindow(
      y,
      (L.yWaist + L.yHighHip) * 0.5,
      0.042
    );

    const gluteSpread = Math.max(0.035, (L.yHighHip - L.yCrotch) * 0.44);
    const gluteMask = gaussianWindow(y, L.yHip, gluteSpread);
    const glutealFoldMask = gaussianWindow(y, L.yCrotch + 0.012, 0.016);

    const scapulaMask = gaussianWindow(y, L.yUpperChest - 0.01, 0.065);
    const spineGrooveM =
      y > L.yHip + 0.02 && y < L.yCervicale
        ? (isFemale ? 0.0095 : 0.011) *
          Math.sin(
            ((y - (L.yHip + 0.02)) /
              Math.max(0.15, L.yCervicale - (L.yHip + 0.02))) *
              Math.PI
          )
        : 0;

    const clavicleMask = gaussianWindow(y, L.yShoulder + 0.012, 0.022);
    const trapeziusMask = gaussianWindow(
      y,
      (L.yShoulder + L.yCervicale) * 0.5,
      0.025
    );

    const crotchSpan = Math.max(0.035, L.yHip - L.yCrotch);
    const crotchSaddleMask =
      y < L.yHip
        ? Math.pow(Math.max(0, 1 - (y - L.yCrotch) / crotchSpan), 1.75)
        : 0;

    const jawMask = gaussianWindow(y, L.yJaw + 0.006, 0.024);
    const noseBrowMask = gaussianWindow(
      y,
      L.yJaw + (L.yHeadMax - L.yJaw) * 0.48,
      0.032
    );
    const occiputMask = gaussianWindow(y, L.yHeadMax - 0.01, 0.042);

    return {
      radii,
      detail: {
        gender,
        yNormTorso,
        yNormHead,
        bustMask,
        bustProjectionM,
        underbustIndent,
        ribcageMask,
        navelMask,
        abdomenLineaAlba,
        iliacObliqueMask,
        gluteMask,
        gluteProjectionM,
        glutealFoldMask,
        scapulaMask,
        spineGrooveM,
        clavicleMask,
        trapeziusMask,
        crotchSaddleMask,
        jawMask,
        noseBrowMask,
        occiputMask,
      },
    };
  };

  const sampleSurfacePoint = (y: number, theta: number, radialOffsetM = 0) => {
    const { radii, detail } = evalAtY(y);
    return sampleCrossSectionPoint(radii, theta, y, radialOffsetM, detail);
  };

  const sampleClosedRing = (
    y: number,
    segments = 64,
    radialOffsetM = OVERLAY_OFFSET_M
  ) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      pts.push(sampleSurfacePoint(y, theta, radialOffsetM));
    }
    return pts;
  };

  return {
    landmarks: L,
    evalAtY,
    sampleSurfacePoint,
    sampleClosedRing,
  };
}

/**
 * Evaluates anatomically sculpted arms/hands and legs.
 */
export function createLimbEvaluators(
  m: MeasurementsRecord,
  gender: Gender,
  landmarks?: AnatomicalLandmarks
) {
  const L = landmarks ?? computeAnatomicalLandmarks(m, gender);
  const isFemale = gender === 'female';

  const deltoidAxes = circumferenceToEllipseAxes(
    m.bicep * (isFemale ? 1.14 : 1.22) * CM_TO_M,
    0.88
  );
  const bicepAxes = circumferenceToEllipseAxes(m.bicep * CM_TO_M, 0.92);
  const elbowAxes = circumferenceToEllipseAxes(m.elbow * CM_TO_M, 1.06);
  const forearmAxes = circumferenceToEllipseAxes(m.forearm * CM_TO_M, 1.1);
  const wristAxes = circumferenceToEllipseAxes(m.wrist * CM_TO_M, 1.34);
  const handPalmA = m.handWidth * CM_TO_M * 0.5;
  const handPalmB = wristAxes.b * 0.72;

  const armStationsT = [0.0, 0.08, 0.25, 0.48, 0.62, 0.84, 0.9, 0.95, 1.0];
  const armCurveL = new THREE.CatmullRomCurve3(
    [
      L.armRootL,
      L.armShoulderL,
      L.armBicepL,
      L.armElbowL,
      L.armForearmL,
      L.armWristL,
      L.handPalmL,
      L.handKnuckleL,
      L.handTipL,
    ],
    false,
    'centripetal',
    0.35
  );

  const interpArmA = createMonotoneHermiteInterpolator(armStationsT, [
    deltoidAxes.a * 0.95,
    deltoidAxes.a * 1.05,
    bicepAxes.a,
    elbowAxes.a,
    forearmAxes.a,
    wristAxes.a,
    handPalmA * 1.05,
    handPalmA * 0.96,
    0.005,
  ]);
  const interpArmB = createMonotoneHermiteInterpolator(armStationsT, [
    deltoidAxes.b * 1.02,
    deltoidAxes.b * 1.04,
    bicepAxes.b,
    elbowAxes.b,
    forearmAxes.b,
    wristAxes.b,
    handPalmB * 1.02,
    handPalmB * 0.74,
    0.003,
  ]);

  const gaussian1D = (val: number, center: number, sigma: number) =>
    Math.exp(-0.5 * Math.pow((val - center) / sigma, 2));

  const sampleArmPoint = (
    side: 'left' | 'right',
    t: number,
    angleRad: number,
    radialOffsetM = 0
  ): THREE.Vector3 => {
    const clampedT = Math.max(0, Math.min(1, t));
    const centerL = armCurveL.getPoint(clampedT);
    const tangentL = armCurveL.getTangent(clampedT).normalize();

    const forwardRef = new THREE.Vector3(0, 0, 1);
    const latOutL = new THREE.Vector3()
      .crossVectors(tangentL, forwardRef)
      .normalize();
    const antForward = new THREE.Vector3()
      .crossVectors(latOutL, tangentL)
      .normalize();

    const a = interpArmA(clampedT) + radialOffsetM;
    const b = interpArmB(clampedT) + radialOffsetM;

    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    const deltoidMask = gaussian1D(clampedT, 0.11, 0.075);
    const deltoidBulge =
      cosA > 0 ? deltoidMask * 0.0065 * Math.pow(cosA, 1.3) : 0;

    const bicepMask = gaussian1D(clampedT, 0.26, 0.09);
    const bicepBulge =
      sinA > 0
        ? bicepMask * (isFemale ? 0.0028 : 0.006) * Math.pow(sinA, 1.6)
        : -bicepMask * (isFemale ? 0.002 : 0.004) * Math.pow(-sinA, 1.6);

    const elbowMask = gaussian1D(clampedT, 0.48, 0.045);
    const elbowShift =
      sinA < -0.3
        ? -elbowMask * 0.0055 * Math.pow(-sinA, 2.5)
        : sinA > 0.3
        ? -elbowMask * 0.003 * Math.pow(sinA, 2)
        : 0;

    const localOut = cosA * a + deltoidBulge;
    const localAnt = sinA * b + bicepBulge + elbowShift;

    const ptL = centerL
      .clone()
      .addScaledVector(latOutL, localOut)
      .addScaledVector(antForward, localAnt);

    if (side === 'right') {
      ptL.x = -ptL.x;
    }
    return ptL;
  };

  const sampleArmRing = (
    side: 'left' | 'right',
    t: number,
    segments = 40,
    radialOffsetM = OVERLAY_OFFSET_M
  ): THREE.Vector3[] => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      pts.push(sampleArmPoint(side, t, theta, radialOffsetM));
    }
    return pts;
  };

  const thighAxes = circumferenceToEllipseAxes(m.thigh * CM_TO_M, 0.91);
  const midThighAxes = circumferenceToEllipseAxes(m.midThigh * CM_TO_M, 0.93);
  const kneeAxes = circumferenceToEllipseAxes(m.knee * CM_TO_M, 0.95);
  const calfAxes = circumferenceToEllipseAxes(m.calf * CM_TO_M, 0.92);
  const ankleAxes = circumferenceToEllipseAxes(m.ankle * CM_TO_M, 0.88);

  const legStationsT = [0.0, 0.06, 0.14, 0.35, 0.56, 0.75, 0.9, 1.0];
  const legCurveL = new THREE.CatmullRomCurve3(
    [
      L.legPelvisRootL,
      L.legTopL,
      L.legThighL,
      L.legMidThighL,
      L.legKneeL,
      L.legCalfL,
      L.legLowerShinL,
      L.legAnkleL,
    ],
    false,
    'centripetal',
    0.35
  );

  const interpLegA = createMonotoneHermiteInterpolator(legStationsT, [
    thighAxes.a * 0.92,
    thighAxes.a * 0.98,
    thighAxes.a,
    midThighAxes.a,
    kneeAxes.a,
    calfAxes.a,
    ankleAxes.a * 1.04,
    ankleAxes.a,
  ]);
  const interpLegB = createMonotoneHermiteInterpolator(legStationsT, [
    thighAxes.b * 1.02,
    thighAxes.b * 1.02,
    thighAxes.b,
    midThighAxes.b,
    kneeAxes.b,
    calfAxes.b,
    ankleAxes.b * 1.05,
    ankleAxes.b,
  ]);

  const sampleLegPoint = (
    side: 'left' | 'right',
    t: number,
    angleRad: number,
    radialOffsetM = 0
  ): THREE.Vector3 => {
    const clampedT = Math.max(0, Math.min(1, t));
    const centerL = legCurveL.getPoint(clampedT);
    const a = interpLegA(clampedT) + radialOffsetM;
    const b = interpLegB(clampedT) + radialOffsetM;

    const cosT = Math.cos(angleRad);
    const sinT = Math.sin(angleRad);

    // Subtle inner thigh contour for clean anime thigh gap near crotch (t < 0.25, cosT < 0)
    const innerThighCarve =
      clampedT < 0.28 && cosT < 0
        ? 0.0055 * (1 - clampedT / 0.28) * Math.pow(-cosT, 1.6)
        : 0;

    const quadMask = gaussian1D(clampedT, 0.32, 0.14);
    const quadFrontShift =
      sinT > 0 ? quadMask * 0.0055 * Math.pow(sinT, 1.4) : 0;

    const kneeMask = gaussian1D(clampedT, 0.56, 0.042);
    const patellaShift =
      sinT > 0.35
        ? kneeMask * 0.0055 * Math.pow(sinT, 2.6)
        : sinT < -0.35
        ? kneeMask * 0.004 * Math.pow(-sinT, 2.2)
        : 0;

    const calfMask = gaussian1D(clampedT, 0.74, 0.095);
    const calfBackBulge =
      sinT < 0 ? -calfMask * 0.0115 * Math.pow(-sinT, 1.35) : 0;
    const calfLateralCurve =
      cosT > 0 ? calfMask * 0.0038 * Math.pow(cosT, 1.5) : 0;

    const ankleMask = gaussian1D(clampedT, 0.99, 0.035);
    const malleolusShift =
      Math.abs(cosT) > 0.75
        ? Math.sign(cosT) * ankleMask * 0.0035 * Math.pow(Math.abs(cosT), 3)
        : 0;

    const xLocal =
      cosT * a + innerThighCarve + calfLateralCurve + malleolusShift;
    const zLocal = sinT * b + quadFrontShift + patellaShift + calfBackBulge;

    const pt = new THREE.Vector3(
      centerL.x + xLocal,
      centerL.y,
      centerL.z + zLocal
    );
    if (side === 'right') {
      pt.x = -pt.x;
    }
    return pt;
  };

  const sampleLegRing = (
    side: 'left' | 'right',
    t: number,
    segments = 44,
    radialOffsetM = OVERLAY_OFFSET_M
  ): THREE.Vector3[] => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      pts.push(sampleLegPoint(side, t, theta, radialOffsetM));
    }
    return pts;
  };

  return {
    armStationsT,
    legStationsT,
    sampleArmPoint,
    sampleArmRing,
    sampleLegPoint,
    sampleLegRing,
  };
}

/**
 * Generates exact 3D surface-hugging coordinates (+2.2mm offset) for all 50 measurement overlays.
 */
export function computeAllMeasurementOverlays(
  m: MeasurementsRecord,
  gender: Gender
): Record<MeasurementKey, OverlayGeometryData> {
  const L = computeAnatomicalLandmarks(m, gender);
  const torso = createTorsoEvaluator(m, gender, L);
  const limbs = createLimbEvaluators(m, gender, L);
  const off = OVERLAY_OFFSET_M;

  const result = {} as Record<MeasurementKey, OverlayGeometryData>;

  const addRing = (
    key: MeasurementKey,
    points: THREE.Vector3[],
    labelIndexRatio = 0.22
  ) => {
    const idx = Math.floor(points.length * labelIndexRatio) % points.length;
    result[key] = {
      key,
      type: 'ring',
      points,
      closed: true,
      labelPosition: points[idx].clone(),
    };
  };

  const addLine = (
    key: MeasurementKey,
    points: THREE.Vector3[],
    closed = false,
    labelIndexRatio = 0.5
  ) => {
    const idx = Math.min(
      points.length - 1,
      Math.max(0, Math.floor(points.length * labelIndexRatio))
    );
    result[key] = {
      key,
      type: 'line',
      points,
      closed,
      labelPosition: points[idx].clone(),
    };
  };

  addRing('head', torso.sampleClosedRing(L.yHeadMax, 56, off), 0.18);
  addRing('neck', torso.sampleClosedRing(L.yCervicale + 0.012, 52, off), 0.2);
  addRing('upperChest', torso.sampleClosedRing(L.yUpperChest, 64, off), 0.22);
  addRing('chest', torso.sampleClosedRing(L.yChest, 64, off), 0.25);
  addRing('underbust', torso.sampleClosedRing(L.yUnderbust, 64, off), 0.24);
  addRing('waist', torso.sampleClosedRing(L.yWaist, 64, off), 0.22);
  addRing('highHip', torso.sampleClosedRing(L.yHighHip, 64, off), 0.2);
  addRing('hip', torso.sampleClosedRing(L.yHip, 64, off), 0.23);

  addRing('thigh', limbs.sampleLegRing('left', 0.14, 48, off), 0.15);
  addRing('midThigh', limbs.sampleLegRing('left', 0.35, 48, off), 0.15);
  addRing('knee', limbs.sampleLegRing('left', 0.56, 44, off), 0.2);
  addRing('calf', limbs.sampleLegRing('left', 0.75, 44, off), 0.2);
  addRing('ankle', limbs.sampleLegRing('left', 1.0, 40, off), 0.2);

  addRing('bicep', limbs.sampleArmRing('left', 0.25, 44, off), 0.12);
  addRing('elbow', limbs.sampleArmRing('left', 0.48, 40, off), 0.12);
  addRing('forearm', limbs.sampleArmRing('left', 0.62, 40, off), 0.12);
  addRing('wrist', limbs.sampleArmRing('left', 0.84, 36, off), 0.15);

  {
    const pts: THREE.Vector3[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const theta = Math.PI + u * Math.PI;
      const archY =
        L.yShoulder +
        Math.sin(u * Math.PI) * (L.yCervicale - L.yShoulder) * 0.75;
      pts.push(torso.sampleSurfacePoint(archY, theta, off * 1.4));
    }
    addLine('shoulderWidth', pts, false, 0.5);
  }

  {
    const pts: THREE.Vector3[] = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = THREE.MathUtils.lerp(L.yCervicale + 0.008, L.yShoulder, u);
      pts.push(torso.sampleSurfacePoint(y, 0.04, off * 1.6));
    }
    addLine('singleShoulderLength', pts, false, 0.5);
  }

  {
    const pts: THREE.Vector3[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const theta = THREE.MathUtils.lerp(Math.PI * 0.82, Math.PI * 0.18, u);
      pts.push(torso.sampleSurfacePoint(L.yUpperChest, theta, off * 1.5));
    }
    addLine('acrossFrontWidth', pts, false, 0.5);
  }

  {
    const pts: THREE.Vector3[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const theta = THREE.MathUtils.lerp(Math.PI * 1.18, Math.PI * 1.82, u);
      pts.push(torso.sampleSurfacePoint(L.yUpperChest, theta, off * 1.5));
    }
    addLine('acrossBackWidth', pts, false, 0.5);
  }

  {
    const pts: THREE.Vector3[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = THREE.MathUtils.lerp(L.yCervicale + 0.005, L.yWaist, u);
      const theta = THREE.MathUtils.lerp(
        Math.PI * 0.34,
        Math.PI * 0.38,
        Math.sin(u * Math.PI * 0.5)
      );
      pts.push(torso.sampleSurfacePoint(y, theta, off * 1.6));
    }
    addLine('frontWaistLength', pts, false, 0.52);
  }

  {
    const pts: THREE.Vector3[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = THREE.MathUtils.lerp(L.yCervicale, L.yWaist, u);
      pts.push(torso.sampleSurfacePoint(y, Math.PI * 1.5, off * 1.6));
    }
    addLine('backWaistLength', pts, false, 0.5);
  }

  {
    const pts: THREE.Vector3[] = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = THREE.MathUtils.lerp(L.yArmpit, L.yWaist, u);
      pts.push(torso.sampleSurfacePoint(y, Math.PI, off * 1.6));
    }
    addLine('sideTorsoLength', pts, false, 0.5);
  }

  {
    const pts: THREE.Vector3[] = [];
    const halfSteps = 32;
    for (let i = 0; i <= halfSteps; i++) {
      const u = i / halfSteps;
      const y = THREE.MathUtils.lerp(L.yShoulder, L.yCrotch, u);
      const theta = THREE.MathUtils.lerp(Math.PI * 0.65, Math.PI * 0.52, u);
      pts.push(torso.sampleSurfacePoint(y, theta, off * 1.8));
    }
    for (let i = 1; i <= halfSteps; i++) {
      const u = i / halfSteps;
      const y = THREE.MathUtils.lerp(L.yCrotch, L.yShoulder, u);
      const theta = THREE.MathUtils.lerp(Math.PI * 1.48, Math.PI * 1.35, u);
      pts.push(torso.sampleSurfacePoint(y, theta, off * 1.8));
    }
    addLine('torsoLoop', pts, true, 0.25);
  }

  {
    const pts: THREE.Vector3[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = THREE.MathUtils.lerp(0.08, 0.84, u);
      pts.push(limbs.sampleArmPoint('left', t, 0, off * 1.6));
    }
    addLine('sleeveFromShoulder', pts, false, 0.52);
  }

  {
    const pts: THREE.Vector3[] = [];
    const shoulderSteps = 12;
    for (let i = 0; i <= shoulderSteps; i++) {
      const u = i / shoulderSteps;
      const y = THREE.MathUtils.lerp(L.yCervicale, L.yShoulder, u);
      const theta = THREE.MathUtils.lerp(Math.PI * 1.5, Math.PI, u);
      pts.push(torso.sampleSurfacePoint(y, theta, off * 1.7));
    }
    const armSteps = 24;
    for (let i = 1; i <= armSteps; i++) {
      const u = i / armSteps;
      const t = THREE.MathUtils.lerp(0.08, 0.84, u);
      pts.push(limbs.sampleArmPoint('right', t, 0, off * 1.7));
    }
    addLine('sleeveFromNeck', pts, false, 0.55);
  }

  {
    const pts: THREE.Vector3[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = THREE.MathUtils.lerp(0.14, 0.84, u);
      pts.push(limbs.sampleArmPoint('left', t, Math.PI, off * 1.6));
    }
    addLine('sleeveFromArmpit', pts, false, 0.5);
  }

  {
    const pts: THREE.Vector3[] = [];
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = THREE.MathUtils.lerp(0.08, 0.48, u);
      pts.push(limbs.sampleArmPoint('right', t, 0.25, off * 1.6));
    }
    addLine('shoulderToElbow', pts, false, 0.5);
  }

  {
    const pts: THREE.Vector3[] = [];
    const hipSteps = 12;
    for (let i = 0; i <= hipSteps; i++) {
      const u = i / hipSteps;
      const y = THREE.MathUtils.lerp(L.yWaist, L.yHip, u);
      pts.push(torso.sampleSurfacePoint(y, 0, off * 1.7));
    }
    const legSteps = 26;
    for (let i = 1; i <= legSteps; i++) {
      const u = i / legSteps;
      pts.push(limbs.sampleLegPoint('left', u, 0, off * 1.7));
    }
    addLine('outseamFromWaist', pts, false, 0.52);
  }

  {
    const pts: THREE.Vector3[] = [];
    const hipSteps = 8;
    for (let i = 0; i <= hipSteps; i++) {
      const u = i / hipSteps;
      const y = THREE.MathUtils.lerp(L.yHighHip, L.yHip, u);
      pts.push(torso.sampleSurfacePoint(y, Math.PI, off * 1.7));
    }
    const legSteps = 26;
    for (let i = 1; i <= legSteps; i++) {
      const u = i / legSteps;
      pts.push(limbs.sampleLegPoint('right', u, 0, off * 1.7));
    }
    addLine('outseamFromHighHip', pts, false, 0.55);
  }

  {
    const pts: THREE.Vector3[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = THREE.MathUtils.lerp(0.07, 1.0, u);
      pts.push(limbs.sampleLegPoint('left', t, Math.PI, off * 1.7));
    }
    addLine('inseamLength', pts, false, 0.48);
  }

  {
    const pts: THREE.Vector3[] = [];
    const hipSteps = 10;
    for (let i = 0; i <= hipSteps; i++) {
      const u = i / hipSteps;
      const y = THREE.MathUtils.lerp(L.yWaist, L.yHip, u);
      pts.push(torso.sampleSurfacePoint(y, Math.PI * 0.94, off * 1.9));
    }
    const legSteps = 16;
    for (let i = 1; i <= legSteps; i++) {
      const u = (i / legSteps) * 0.56;
      pts.push(limbs.sampleLegPoint('right', u, 0.25, off * 1.9));
    }
    addLine('waistToKneeLength', pts, false, 0.5);
  }

  const frontRisePts: THREE.Vector3[] = [];
  {
    const steps = 22;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = THREE.MathUtils.lerp(L.yWaist, L.yCrotch, u);
      const pt = torso.sampleSurfacePoint(y, Math.PI * 0.5, off * 1.7);
      pt.z *= 1 - Math.pow(u, 3.2) * 0.85;
      pt.y -= Math.pow(u, 2) * 0.008;
      frontRisePts.push(pt);
    }
    addLine('frontRise', frontRisePts, false, 0.45);
  }

  const backRisePts: THREE.Vector3[] = [];
  {
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const y = THREE.MathUtils.lerp(L.yWaist, L.yCrotch, u);
      const pt = torso.sampleSurfacePoint(y, Math.PI * 1.5, off * 1.7);
      pt.z *= 1 - Math.pow(u, 3.4) * 0.88;
      pt.y -= Math.pow(u, 2) * 0.008;
      backRisePts.push(pt);
    }
    addLine('backRise', backRisePts, false, 0.48);
  }

  {
    const combined = [
      ...frontRisePts.map((p) => p.clone().add(new THREE.Vector3(0.005, 0, 0))),
      ...backRisePts
        .slice(0, -1)
        .reverse()
        .map((p) => p.clone().add(new THREE.Vector3(0.005, 0, 0))),
    ];
    addLine('crotchCurveTotal', combined, false, 0.5);
  }

  {
    const pts: THREE.Vector3[] = [];
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = THREE.MathUtils.lerp(0.84, 1.0, i / steps);
      pts.push(limbs.sampleArmPoint('left', t, 0, off * 1.4));
    }
    addLine('handLength', pts, false, 0.5);
  }

  {
    const p1 = limbs.sampleArmPoint('left', 0.93, Math.PI * 0.5, off * 1.4);
    const pMid = limbs.sampleArmPoint('left', 0.93, 0, off * 1.6);
    const p2 = limbs.sampleArmPoint('left', 0.93, Math.PI * 1.5, off * 1.4);
    addLine('handWidth', [p1, pMid, p2], false, 0.5);
  }

  {
    const footLenM = m.footLength * CM_TO_M;
    const footWidthM = m.footWidth * CM_TO_M;
    const heelZ = L.legAnkleL.z - footLenM * 0.24;
    const toeZ = L.legAnkleL.z + footLenM * 0.76;
    const xOut = L.ankleStanceHalfX + footWidthM * 0.52 + off;
    const yFootLine = 0.014;
    const pts = [
      new THREE.Vector3(xOut, yFootLine, heelZ),
      new THREE.Vector3(xOut, yFootLine, (heelZ + toeZ) * 0.5),
      new THREE.Vector3(xOut, yFootLine, toeZ),
    ];
    addLine('footLength', pts, false, 0.5);
  }

  {
    const footLenM = m.footLength * CM_TO_M;
    const footWidthM = m.footWidth * CM_TO_M;
    const ballZ = L.legAnkleL.z + footLenM * 0.42;
    const xInner = L.ankleStanceHalfX - footWidthM * 0.48;
    const xOuter = L.ankleStanceHalfX + footWidthM * 0.52;
    const pts = [
      new THREE.Vector3(xInner, 0.022 + off, ballZ),
      new THREE.Vector3(L.ankleStanceHalfX, 0.032 + off, ballZ),
      new THREE.Vector3(xOuter, 0.022 + off, ballZ),
    ];
    addLine('footWidth', pts, false, 0.5);
  }

  const heightConfigs: Array<{
    key: MeasurementKey;
    y: number;
    columnIndex: number;
    anchorPoint: THREE.Vector3;
  }> = [
    {
      key: 'totalHeight',
      y: L.yCrown,
      columnIndex: 0,
      anchorPoint: new THREE.Vector3(0, L.yCrown, 0),
    },
    {
      key: 'cervicaleHeight',
      y: L.yCervicale,
      columnIndex: 1,
      anchorPoint: torso.sampleSurfacePoint(L.yCervicale, Math.PI, off),
    },
    {
      key: 'shoulderHeight',
      y: L.yShoulder,
      columnIndex: 2,
      anchorPoint: new THREE.Vector3(-L.shoulderHalfSpan, L.yShoulder, 0),
    },
    {
      key: 'chestHeight',
      y: L.yChest,
      columnIndex: 3,
      anchorPoint: torso.sampleSurfacePoint(L.yChest, Math.PI, off),
    },
    {
      key: 'underbustHeight',
      y: L.yUnderbust,
      columnIndex: 4,
      anchorPoint: torso.sampleSurfacePoint(L.yUnderbust, Math.PI, off),
    },
    {
      key: 'waistHeight',
      y: L.yWaist,
      columnIndex: 1,
      anchorPoint: torso.sampleSurfacePoint(L.yWaist, Math.PI, off),
    },
    {
      key: 'highHipHeight',
      y: L.yHighHip,
      columnIndex: 2,
      anchorPoint: torso.sampleSurfacePoint(L.yHighHip, Math.PI, off),
    },
    {
      key: 'hipHeight',
      y: L.yHip,
      columnIndex: 3,
      anchorPoint: torso.sampleSurfacePoint(L.yHip, Math.PI, off),
    },
    {
      key: 'crotchHeight',
      y: L.yCrotch,
      columnIndex: 4,
      anchorPoint: new THREE.Vector3(0, L.yCrotch, 0),
    },
    {
      key: 'kneeHeight',
      y: L.yKnee,
      columnIndex: 2,
      anchorPoint: limbs.sampleLegPoint('right', 0.56, 0, off),
    },
  ];

  for (const hc of heightConfigs) {
    const xCol = -(L.shoulderHalfSpan + 0.16 + hc.columnIndex * 0.032);
    const zCol = -0.02;
    const topBarPt = new THREE.Vector3(xCol, hc.y, zCol);
    const bottomPt = new THREE.Vector3(xCol, 0.002, zCol);
    result[hc.key] = {
      key: hc.key,
      type: 'height',
      points: [hc.anchorPoint, topBarPt, bottomPt],
      closed: false,
      labelPosition: new THREE.Vector3(xCol, hc.y * 0.55, zCol),
    };
  }

  return result;
}
