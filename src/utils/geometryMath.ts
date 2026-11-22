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
  yNormTorso: number;      // 0 at crotch -> 1 at cervicale
  yNormHead: number;       // 0 at cervicale -> 1 at crown
  bustMask: number;        // 0..1 vertical Gaussian at chest level
  bustProjectionM: number; // Anterior breast / pectoral projection in meters
  underbustIndent: number; // Inframammary fold definition
  ribcageMask: number;     // Thoracic cage contour
  navelMask: number;       // Umbilicus depression just below waist
  abdomenLineaAlba: number;// Central vertical linea alba groove
  iliacObliqueMask: number;// External oblique / iliac crest flare
  gluteMask: number;       // 0..1 vertical window over gluteus maximus
  gluteProjectionM: number;// Posterior gluteal hemisphere projection in meters
  glutealFoldMask: number; // Crisp infragluteal crease at bottom of buttocks
  scapulaMask: number;     // Bilateral shoulder-blade projection on upper back
  spineGrooveM: number;    // Erector spinae / spinal furrow depth
  clavicleMask: number;    // Collarbone anterior ridge near yCervicale/yShoulder
  trapeziusMask: number;   // Neck-to-shoulder trapezius transition
  crotchSaddleMask: number;// Perineal bifurcation & inguinal crease at pelvis base
  jawMask: number;         // Mandible / chin projection on head
  noseBrowMask: number;    // Facial profile projection
  occiputMask: number;     // Back of skull (occipital bone) curve
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
  yJaw: number;
  yHeadMax: number;
  yCrown: number;

  // Key widths and offsets in meters
  shoulderHalfSpan: number;
  neckHalfWidth: number;
  hipStanceHalfX: number;
  kneeStanceHalfX: number;
  ankleStanceHalfX: number;

  // Arm centerline joints (left side, +X; right side mirrors X -> -X)
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

  // Leg centerline joints (left side, +X; right side mirrors X -> -X)
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
 * incorporating realistic breast/pectoral lobes, sternum cleavage, ribcage, linea alba, navel,
 * iliac obliques, bilateral gluteal hemispheres, infragluteal fold, erector spinae furrow,
 * scapulae, clavicles, and craniofacial jaw/brow/occiput structure.
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
      // Bilateral breast / pectoral centers at ~26 deg from center-front (|cosT| ≈ 0.44, sinT ≈ 0.90)
      const lateralDistance = Math.abs(absCos - (isFemale ? 0.43 : 0.48));
      const lobeGaussian = Math.exp(-Math.pow(lateralDistance / (isFemale ? 0.25 : 0.31), 2));
      const frontEnvelope = Math.pow(sinT, 1.25);

      // Central sternum cleavage valley at cosT = 0, sinT = 1
      const sternumValley = Math.exp(-Math.pow(absCos / (isFemale ? 0.14 : 0.12), 2)) * Math.pow(sinT, 3);

      const dzBust =
        detail.bustMask *
        detail.bustProjectionM *
        frontEnvelope *
        (1.12 * lobeGaussian + (isFemale ? 0.16 : 0.25) - (isFemale ? 0.38 : 0.24) * sternumValley);

      z += dzBust;

      // Subtle lateral fullness of breast/pec
      if (isFemale) {
        x *= 1 + detail.bustMask * 0.035 * lobeGaussian * frontEnvelope;
      }
    }

    // 2. INFRAMAMMARY FOLD & ANTERIOR RIBCAGE TAPER
    if (detail.underbustIndent > 0.001 && sinT > 0.2) {
      const underLobe = Math.exp(-Math.pow((absCos - 0.42) / 0.28, 2));
      z -= detail.underbustIndent * Math.pow(sinT, 1.6) * (0.5 + 0.5 * underLobe);
    }

    // 3. LINEA ALBA & RECTUS ABDOMINIS / NAVEL (UMBILICUS)
    if (detail.abdomenLineaAlba > 0.001 && sinT > 0.5) {
      // Subtle vertical central linea alba groove & lateral rectus border (six-pack / toned linea semilunaris)
      const centerGroove = Math.exp(-Math.pow(absCos / 0.08, 2));
      const semilunarisGroove = Math.exp(-Math.pow((absCos - 0.36) / 0.07, 2));
      z -= detail.abdomenLineaAlba * Math.pow(sinT, 3) * (centerGroove + 0.45 * semilunarisGroove);
    }
    if (detail.navelMask > 0.001 && sinT > 0.85) {
      const navelSpot = Math.exp(-Math.pow(absCos / 0.055, 2));
      z -= detail.navelMask * 0.0065 * navelSpot;
    }

    // 4. ILIAC CREST & EXTERNAL OBLIQUE FLARE
    if (detail.iliacObliqueMask > 0.001) {
      const obliqueZone = Math.exp(-Math.pow((absCos - 0.86) / 0.18, 2));
      x += Math.sign(cosT) * detail.iliacObliqueMask * 0.0055 * obliqueZone;
    }

    // 5. POSTERIOR GLUTEAL HEMISPHERES & INTERGLUTEAL CLEFT (sinT < 0)
    if (detail.gluteMask > 0.001 && sinT < 0) {
      const backSin = -sinT;
      // Bilateral gluteus maximus lobes centered at |cosT| ≈ 0.42
      const gluteLobe = Math.exp(-Math.pow((absCos - 0.41) / 0.29, 2));
      // Deep intergluteal natal cleft along center-back (cosT = 0, sinT = -1)
      const natalCleft = Math.exp(-Math.pow(absCos / 0.11, 2)) * Math.pow(backSin, 3.5);

      const dzGlute =
        detail.gluteMask *
        detail.gluteProjectionM *
        Math.pow(backSin, 1.15) *
        (1.08 * gluteLobe + 0.22 - 0.65 * natalCleft);

      z -= dzGlute;

      // Hip/trochanter lateral rounding
      const trochanterMask = Math.exp(-Math.pow((absCos - 0.92) / 0.16, 2));
      x += Math.sign(cosT) * detail.gluteMask * 0.004 * trochanterMask;
    }

    // 6. INFRAGLUTEAL FOLD (creased indentation directly below glutes)
    if (detail.glutealFoldMask > 0.001 && sinT < -0.25) {
      const foldLobe = Math.exp(-Math.pow((absCos - 0.42) / 0.3, 2));
      z += detail.glutealFoldMask * 0.009 * Math.pow(-sinT, 1.5) * foldLobe;
    }

    // 7. SPINAL FURROW (ERECTOR SPINAE) & SCAPULAE (UPPER BACK)
    if (detail.spineGrooveM > 0.0002 && sinT < -0.4) {
      const backSin = -sinT;
      // Central vertebral groove
      const spineFurrow = Math.exp(-Math.pow(absCos / 0.095, 2)) * Math.pow(backSin, 3.5);
      // Flanking erector spinae muscle ridges at |cosT| ≈ 0.22
      const erectorRidge = Math.exp(-Math.pow((absCos - 0.22) / 0.11, 2)) * Math.pow(backSin, 2.2);
      z += detail.spineGrooveM * (spineFurrow - 0.38 * erectorRidge);
    }

    if (detail.scapulaMask > 0.001 && sinT < -0.15) {
      const backSin = -sinT;
      const scapulaLobe = Math.exp(-Math.pow((absCos - 0.46) / 0.26, 2));
      z -= detail.scapulaMask * 0.011 * Math.pow(backSin, 1.4) * scapulaLobe;
    }

    // 8. CLAVICLE (COLLARBONE) & STERNOCLAVICULAR NOTCH
    if (detail.clavicleMask > 0.001 && sinT > 0.25) {
      const clavicleBar = Math.exp(-Math.pow((absCos - 0.52) / 0.32, 2));
      const jugularNotch = Math.exp(-Math.pow(absCos / 0.13, 2));
      z += detail.clavicleMask * 0.0055 * Math.pow(sinT, 1.6) * (clavicleBar - 0.7 * jugularNotch);
    }

    // 9. PELVIC SADDLE & INGUINAL ARCH (at bottom of pelvis near yCrotch)
    if (detail.crotchSaddleMask > 0.001 && radialOffsetM === 0) {
      // In human anatomy, the lateral hip arch rises along the inguinal fold while the center forms the pubic/perineal saddle
      const lateralArch = Math.pow(absCos, 1.6);
      yOffset += detail.crotchSaddleMask * 0.032 * lateralArch;
      // Central perineal narrowing
      const centerPinch = Math.exp(-Math.pow(absCos / 0.22, 2)) * Math.pow(absSin, 1.5);
      z *= 1 - detail.crotchSaddleMask * 0.28 * centerPinch;
    }

    // 10. CRANIOFACIAL ANATOMY (Jawline/Chin, Cheekbones/Nose/Brow, Occiput)
    if (detail.jawMask > 0.001) {
      if (sinT > 0) {
        // Forward chin/mandible projection & tapered jawline
        const chinCenter = Math.exp(-Math.pow(absCos / 0.35, 2));
        z += detail.jawMask * 0.022 * Math.pow(sinT, 1.5) * (0.55 + 0.45 * chinCenter);
        x *= 1 - detail.jawMask * 0.12 * Math.pow(sinT, 2);
      }
    }
    if (detail.noseBrowMask > 0.001 && sinT > 0.3) {
      // Subtle nose bridge and zygomatic cheekbone structure
      const noseRidge = Math.exp(-Math.pow(absCos / 0.11, 2)) * Math.pow(sinT, 4);
      const cheekbone = Math.exp(-Math.pow((absCos - 0.58) / 0.2, 2)) * Math.pow(sinT, 1.6);
      z += detail.noseBrowMask * (0.011 * noseRidge + 0.0045 * cheekbone);
    }
    if (detail.occiputMask > 0.001 && sinT < -0.2) {
      // Rounded posterior cranium (occipital bone) above the nape of the neck
      z -= detail.occiputMask * 0.016 * Math.pow(-sinT, 1.4);
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

  // Couple leg heights with inseamLength, outseamFromWaist, waistToKneeLength, and rises
  const avgRiseVertM = ((m.frontRise * 0.86 + m.backRise * 0.72) * 0.5) * CM_TO_M;
  const yAnkle = Math.max(0.062, Math.min(0.105, m.totalHeight * 0.044 * CM_TO_M));

  // Crotch height responds to both crotchHeight and inseamLength
  const yCrotchRaw =
    (m.crotchHeight * 0.45 + (m.inseamLength + yAnkle * 100) * 0.55) * CM_TO_M;
  const yCrotch = Math.max(0.55, Math.min(yCrown * 0.535, yCrotchRaw));

  // Waist height responds to waistHeight, outseamFromWaist, and rise
  const yWaistFromOutseam = yAnkle + m.outseamFromWaist * CM_TO_M * 0.96;
  const yWaistFromRise = yCrotch + avgRiseVertM;
  const yWaistRaw =
    m.waistHeight * CM_TO_M * 0.4 +
    yWaistFromOutseam * 0.35 +
    yWaistFromRise * 0.25;
  const yWaist = Math.max(yCrotch + 0.165, Math.min(yCrown * 0.71, yWaistRaw));

  // High hip and full hip heights between crotch and waist
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

  // Knee height responds to both kneeHeight and waistToKneeLength
  const yKneeFromWaist = yWaist - m.waistToKneeLength * CM_TO_M * 0.97;
  const yKnee = Math.max(
    yAnkle + 0.22,
    Math.min(yCrotch - 0.16, m.kneeHeight * CM_TO_M * 0.5 + yKneeFromWaist * 0.5)
  );

  const yThigh = yCrotch - 0.032;
  const yMidThigh = (yThigh + yKnee) * 0.5;
  const yCalf = yAnkle + (yKnee - yAnkle) * 0.65;

  // Upper torso vertical heights coupled with backWaistLength, frontWaistLength, sideTorsoLength
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

  // Armpit height driven by sideTorsoLength
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

  // Head and neck heights
  const headSpan = Math.max(0.19, yCrown - yCervicale);
  const yNeckMid = yCervicale + headSpan * 0.19;
  const yJaw = yCervicale + headSpan * 0.35;
  const yHeadMax = yCervicale + headSpan * 0.69;

  // Shoulder & neck widths
  const neckRadii = circumferenceToEllipseAxes(m.neck * CM_TO_M, 1.06);
  const neckHalfWidth = neckRadii.a;
  const shoulderHalfFromWidth = m.shoulderWidth * CM_TO_M * 0.49;
  const shoulderHalfFromSeam =
    neckHalfWidth + m.singleShoulderLength * CM_TO_M * 0.92;
  const shoulderHalfSpan =
    shoulderHalfFromWidth * 0.62 + shoulderHalfFromSeam * 0.38;

  // Hip, knee & ankle natural anatomical stance X
  const hipRadii = circumferenceToEllipseAxes(
    m.hip * CM_TO_M,
    isFemale ? 1.38 : 1.31
  );
  const thighRadii = circumferenceToEllipseAxes(m.thigh * CM_TO_M, 0.95);
  // Position femur axes so inner thighs lightly touch/clear at crotch without overlapping
  const hipStanceHalfX = Math.max(
    thighRadii.a * 0.96,
    hipRadii.a * (isFemale ? 0.51 : 0.53)
  );
  const kneeStanceHalfX = hipStanceHalfX * 0.97;
  const ankleStanceHalfX = hipStanceHalfX * 0.95;

  // Natural anatomical arm posture (relaxed ~16 deg abduction, physiological carrying angle & slight elbow flexion)
  const armAbductionRad = THREE.MathUtils.degToRad(isFemale ? 15.5 : 17.5);
  const elbowFlexForwardRad = THREE.MathUtils.degToRad(9.5);
  const carryingAngleRad = THREE.MathUtils.degToRad(isFemale ? 19.5 : 19.0);

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

  const armShoulderL = new THREE.Vector3(shoulderHalfSpan * 0.95, yShoulder, -0.012);
  // Root tucked slightly inside lateral shoulder/clavicle so deltoid merges seamlessly into torso
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

  // Leg centerline joints (Left side +X) — originates inside lateral pelvis at yHip for seamless hip-to-thigh curve!
  const legPelvisRootL = new THREE.Vector3(
    hipStanceHalfX * 0.94,
    yHip - 0.005,
    -0.006
  );
  const legTopL = new THREE.Vector3(hipStanceHalfX, yCrotch + 0.005, -0.002);
  const legThighL = new THREE.Vector3(
    THREE.MathUtils.lerp(hipStanceHalfX, kneeStanceHalfX, 0.16),
    yThigh,
    0.005
  );
  const legMidThighL = new THREE.Vector3(
    THREE.MathUtils.lerp(hipStanceHalfX, kneeStanceHalfX, 0.52),
    yMidThigh,
    0.007
  );
  const legKneeL = new THREE.Vector3(kneeStanceHalfX, yKnee, 0.003);
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

  // Convert key circumferences into base ellipse axes
  const hipAxes = circumferenceToEllipseAxes(
    m.hip * CM_TO_M,
    isFemale ? 1.4 : 1.32
  );
  const highHipAxes = circumferenceToEllipseAxes(
    m.highHip * CM_TO_M,
    isFemale ? 1.37 : 1.31
  );
  const waistAxes = circumferenceToEllipseAxes(
    m.waist * CM_TO_M,
    isFemale ? 1.33 : 1.29
  );
  const underbustAxes = circumferenceToEllipseAxes(
    m.underbust * CM_TO_M,
    isFemale ? 1.36 : 1.34
  );
  const chestAxes = circumferenceToEllipseAxes(
    m.chest * CM_TO_M,
    isFemale ? 1.32 : 1.39
  );
  const upperChestAxes = circumferenceToEllipseAxes(
    m.upperChest * CM_TO_M,
    isFemale ? 1.46 : 1.52
  );
  const neckAxes = circumferenceToEllipseAxes(m.neck * CM_TO_M, 1.04);
  const headAxes = circumferenceToEllipseAxes(m.head * CM_TO_M, 0.81);

  // Factor in acrossFrontWidth, acrossBackWidth, frontRise, backRise
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

  // Bust / pectoral prominence from difference between chest and underbust
  const bustDeltaM = Math.max(0, (m.chest - m.underbust) * CM_TO_M);
  const bustProjectionM = isFemale
    ? Math.min(0.058, 0.02 + bustDeltaM * 0.19)
    : Math.min(0.024, 0.008 + bustDeltaM * 0.08);

  // Gluteal hemisphere prominence from hip-to-waist ratio & backRise
  const hipWaistDeltaM = Math.max(0, (m.hip - m.waist) * CM_TO_M);
  const gluteProjectionM = isFemale
    ? Math.min(0.052, 0.022 + hipWaistDeltaM * 0.08 + gluteDepthBoost)
    : Math.min(0.038, 0.016 + hipWaistDeltaM * 0.06 + gluteDepthBoost);

  // Physiological spinal S-curve (centerZ) + multi-station cross-sections from pelvis to crown
  const yTrapeziusMid = (L.yShoulder + L.yCervicale) * 0.5;
  const yBrow = L.yJaw + (L.yHeadMax - L.yJaw) * 0.55;

  const stations = [
    // 1. Perineal Crotch Saddle Base
    {
      y: L.yCrotch,
      a: hipAxes.a * 0.84,
      bF: hipAxes.b * 0.68 + frontRiseBoost,
      bB: hipAxes.b * 0.76 + gluteDepthBoost * 0.6,
      n: 2.15,
      cZ: -0.004,
    },
    // 2. Full Hip & Gluteal Apex
    {
      y: L.yHip,
      a: hipAxes.a,
      bF: hipAxes.b * (isFemale ? 0.89 : 0.93) + frontRiseBoost,
      bB: hipAxes.b * (isFemale ? 1.05 : 1.02) + gluteDepthBoost,
      n: 2.18,
      cZ: -0.01,
    },
    // 3. High Hip / Iliac Crest
    {
      y: L.yHighHip,
      a: highHipAxes.a,
      bF: highHipAxes.b * 0.96,
      bB: highHipAxes.b * 1.02,
      n: 2.16,
      cZ: -0.002,
    },
    // 4. Natural Waist (Lumbar Lordosis curves forward +Z)
    {
      y: L.yWaist,
      a: waistAxes.a,
      bF: waistAxes.b * 0.98,
      bB: waistAxes.b * 0.99,
      n: 2.08,
      cZ: 0.009,
    },
    // 5. Inframammary Underbust Ribcage
    {
      y: L.yUnderbust,
      a: underbustAxes.a,
      bF: underbustAxes.b * 0.98,
      bB: underbustAxes.b * 1.01,
      n: 2.16,
      cZ: 0.004,
    },
    // 6. Full Bust / Chest Apex
    {
      y: L.yChest,
      a: chestAxes.a * (isFemale ? 0.97 : 1.0),
      bF:
        chestAxes.b * (isFemale ? 0.96 : 1.0) +
        frontBackChestBias * 0.025,
      bB:
        chestAxes.b * (isFemale ? 0.96 : 1.0) -
        frontBackChestBias * 0.025,
      n: 2.22,
      cZ: -0.002,
    },
    // 7. Upper Chest / Axillary Fold Level (Thoracic Kyphosis curves slightly back -Z)
    {
      y: L.yUpperChest,
      a: upperChestWidthAdjusted,
      bF: upperChestAxes.b * 0.94 + frontBackChestBias * 0.02,
      bB: upperChestAxes.b * 1.01 - frontBackChestBias * 0.02,
      n: 2.32,
      cZ: -0.007,
    },
    // 8. Acromion Shoulder Girdle Level
    {
      y: L.yShoulder,
      a: L.shoulderHalfSpan * 0.92,
      bF: upperChestAxes.b * 0.74,
      bB: upperChestAxes.b * 0.84,
      n: 2.36,
      cZ: -0.009,
    },
    // 9. Mid-Trapezius Slope (smooth muscular slope from shoulder tips to neck base)
    {
      y: yTrapeziusMid,
      a: THREE.MathUtils.lerp(L.shoulderHalfSpan * 0.92, neckAxes.a * 1.14, 0.64),
      bF: neckAxes.b * 1.14,
      bB: neckAxes.b * 1.24,
      n: 2.15,
      cZ: -0.005,
    },
    // 10. Cervicale C7 Neck Base
    {
      y: L.yCervicale,
      a: neckAxes.a * 1.06,
      bF: neckAxes.b * 1.02,
      bB: neckAxes.b * 1.05,
      n: 2.02,
      cZ: -0.001,
    },
    // 11. Mid-Neck Column (slight forward cervical tilt)
    {
      y: L.yNeckMid,
      a: neckAxes.a * 0.95,
      bF: neckAxes.b * 0.95,
      bB: neckAxes.b * 0.95,
      n: 1.98,
      cZ: 0.005,
    },
    // 12. Submental Under-Chin / Upper Neck Junction
    {
      y: L.yJaw - 0.014,
      a: neckAxes.a * 0.96,
      bF: neckAxes.b * 0.98,
      bB: neckAxes.b * 0.98,
      n: 2.0,
      cZ: 0.008,
    },
    // 13. Mandible / Chin / Jaw Level
    {
      y: L.yJaw,
      a: headAxes.a * 0.82,
      bF: headAxes.b * 0.9,
      bB: headAxes.b * 0.84,
      n: 2.06,
      cZ: 0.015,
    },
    // 14. Cheekbone / Brow / Mid-Face Level
    {
      y: yBrow,
      a: headAxes.a * 0.97,
      bF: headAxes.b * 0.98,
      bB: headAxes.b * 0.98,
      n: 2.08,
      cZ: 0.011,
    },
    // 15. Maximum Cranial Vault Perimeter
    {
      y: L.yHeadMax,
      a: headAxes.a,
      bF: headAxes.b * 0.97,
      bB: headAxes.b * 1.03,
      n: 2.06,
      cZ: 0.005,
    },
    // 16. Parietal Crown Dome
    {
      y: L.yCrown - 0.022,
      a: headAxes.a * 0.68,
      bF: headAxes.b * 0.68,
      bB: headAxes.b * 0.7,
      n: 2.0,
      cZ: 0.003,
    },
    // 17. Vertex Crown Apex
    {
      y: L.yCrown,
      a: 0.008,
      bF: 0.008,
      bB: 0.008,
      n: 2.0,
      cZ: 0.002,
    },
  ];

  // Ensure strictly increasing Y for Hermite interpolation
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

  // Asymmetric breast/pectoral vertical profile (teardrop fuller lower pole, tapered upper pole)
  const evalBustMask = (y: number) => {
    if (y < L.yUnderbust - 0.02 || y > L.yShoulder) return 0;
    if (y <= L.yChest) {
      const sigmaLow = Math.max(0.022, (L.yChest - L.yUnderbust) * (isFemale ? 0.58 : 0.65));
      return gaussianWindow(y, L.yChest, sigmaLow);
    }
    const sigmaHigh = Math.max(0.028, (L.yUpperChest - L.yChest) * (isFemale ? 0.78 : 0.68));
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
      (isFemale ? 0.009 : 0.0045) *
      gaussianWindow(y, L.yUnderbust, 0.018);
    const ribcageMask = gaussianWindow(
      y,
      (L.yUnderbust + L.yWaist) * 0.52,
      0.045
    );
    const navelY = L.yWaist - (L.yWaist - L.yHighHip) * 0.32;
    const navelMask = gaussianWindow(y, navelY, 0.011);

    const abdomenLineaAlba =
      y > L.yHighHip && y < L.yChest
        ? (isFemale ? 0.0032 : 0.0052) *
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
        ? (isFemale ? 0.0075 : 0.0095) *
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
        ? Math.pow(Math.max(0, 1 - (y - L.yCrotch) / crotchSpan), 1.8)
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
 * Evaluates anatomically sculpted arms/hands and legs with realistic muscle bellies,
 * articular joints (deltoid, bicep/tricep, elbow olecranon, forearm taper, wrist, palm/thumb,
 * pelvis-integrated hip root, quadriceps, patella knee, gastrocnemius calf, shinbone, and ankle malleoli).
 */
export function createLimbEvaluators(
  m: MeasurementsRecord,
  gender: Gender,
  landmarks?: AnatomicalLandmarks
) {
  const L = landmarks ?? computeAnatomicalLandmarks(m, gender);
  const isFemale = gender === 'female';

  // Arm radii at key anatomical stations:
  // t=0.00: shoulder/clavicle root (tucked inside deltoid junction)
  // t=0.08: acromion / deltoid fullness
  // t=0.25: bicep / tricep mid-humeral belly
  // t=0.48: elbow joint (olecranon & epicondyles)
  // t=0.62: proximal forearm (brachioradialis fullness)
  // t=0.84: distal wrist styloid
  // t=0.90: palm / thenar thumb web
  // t=0.95: metacarpal knuckles
  // t=1.00: tapered fingertips
  const deltoidAxes = circumferenceToEllipseAxes(
    m.bicep * (isFemale ? 1.16 : 1.22) * CM_TO_M,
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
    deltoidAxes.a * 1.06,
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
    deltoidAxes.b * 1.05,
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

    const cosA = Math.cos(angleRad); // +1 = lateral outer, -1 = medial inner (armpit side)
    const sinA = Math.sin(angleRad); // +1 = anterior front, -1 = posterior back

    // Anatomical muscle & joint sculpting along the arm:
    // 1. Deltoid lateral sweep (t ≈ 0.08..0.20, outer side cosA > 0)
    const deltoidMask = gaussian1D(clampedT, 0.11, 0.075);
    const deltoidBulge =
      cosA > 0 ? deltoidMask * 0.0075 * Math.pow(cosA, 1.3) : 0;

    // 2. Bicep anterior peak & Tricep posterior contour (t ≈ 0.25)
    const bicepMask = gaussian1D(clampedT, 0.26, 0.09);
    const bicepBulge =
      sinA > 0
        ? bicepMask * (isFemale ? 0.0035 : 0.0065) * Math.pow(sinA, 1.6)
        : -bicepMask * (isFemale ? 0.0025 : 0.0045) * Math.pow(-sinA, 1.6);

    // 3. Elbow olecranon posterior tip & cubital hollow (t ≈ 0.48)
    const elbowMask = gaussian1D(clampedT, 0.48, 0.045);
    const elbowShift =
      sinA < -0.3
        ? -elbowMask * 0.0055 * Math.pow(-sinA, 2.5)
        : sinA > 0.3
        ? -elbowMask * 0.003 * Math.pow(sinA, 2)
        : 0;

    // 4. Thumb / thenar projection on anterior-lateral side of palm (t ≈ 0.89..0.94)
    const thumbMask = gaussian1D(clampedT, 0.91, 0.026);
    const thumbAngleDist = Math.abs(angleRad - Math.PI * 0.42);
    const thumbBulge =
      thumbMask * 0.011 * Math.exp(-Math.pow(thumbAngleDist / 0.45, 2));

    const localOut = cosA * (a + thumbBulge) + deltoidBulge;
    const localAnt = sinA * (b + thumbBulge * 0.6) + bicepBulge + elbowShift;

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

  // Leg stations:
  // t=0.00: legPelvisRootL (at yHip inside lateral pelvis for seamless hip-to-thigh continuity!)
  // t=0.06: legTopL (at yCrotch)
  // t=0.14: legThighL (proximal thigh girth directly below gluteal fold)
  // t=0.35: legMidThighL (mid-thigh quadriceps/hamstrings)
  // t=0.56: legKneeL (patella knee center)
  // t=0.75: legCalfL (maximum gastrocnemius calf belly)
  // t=0.90: legLowerShinL (slender lower shin / Achilles transition)
  // t=1.00: legAnkleL (ankle malleoli)
  const thighAxes = circumferenceToEllipseAxes(m.thigh * CM_TO_M, 0.92);
  const midThighAxes = circumferenceToEllipseAxes(m.midThigh * CM_TO_M, 0.94);
  const kneeAxes = circumferenceToEllipseAxes(m.knee * CM_TO_M, 0.96);
  const calfAxes = circumferenceToEllipseAxes(m.calf * CM_TO_M, 0.93);
  const ankleAxes = circumferenceToEllipseAxes(m.ankle * CM_TO_M, 0.89);

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
    thighAxes.a * 0.94,
    thighAxes.a * 1.01,
    thighAxes.a,
    midThighAxes.a,
    kneeAxes.a,
    calfAxes.a,
    ankleAxes.a * 1.05,
    ankleAxes.a,
  ]);
  const interpLegB = createMonotoneHermiteInterpolator(legStationsT, [
    thighAxes.b * 1.04,
    thighAxes.b * 1.03,
    thighAxes.b,
    midThighAxes.b,
    kneeAxes.b,
    calfAxes.b,
    ankleAxes.b * 1.06,
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

    const cosT = Math.cos(angleRad); // +1 = outer lateral, -1 = inner medial
    const sinT = Math.sin(angleRad); // +1 = anterior front, -1 = posterior back

    // 1. Quadriceps anterior sweep & Vastus Medialis teardrop above knee (t ≈ 0.25..0.46)
    const quadMask = gaussian1D(clampedT, 0.32, 0.14);
    const vastusMedialisMask = gaussian1D(clampedT, 0.45, 0.065);
    const quadFrontShift =
      sinT > 0 ? quadMask * 0.006 * Math.pow(sinT, 1.4) : 0;
    const vastusInnerShift =
      cosT < -0.2 && sinT > 0.1
        ? -vastusMedialisMask * 0.0045 * Math.pow(-cosT, 1.4) * sinT
        : 0;

    // 2. Patella (kneecap) anterior prominence & popliteal posterior hollow (t ≈ 0.56)
    const kneeMask = gaussian1D(clampedT, 0.56, 0.042);
    const patellaShift =
      sinT > 0.35
        ? kneeMask * 0.0055 * Math.pow(sinT, 2.6)
        : sinT < -0.35
        ? kneeMask * 0.004 * Math.pow(-sinT, 2.2) // popliteal hollow pulls slightly forward (+Z)
        : 0;

    // 3. Gastrocnemius calf muscle posterior projection & lateral/medial sweep (t ≈ 0.74)
    const calfMask = gaussian1D(clampedT, 0.74, 0.095);
    const calfBackBulge =
      sinT < 0 ? -calfMask * 0.0115 * Math.pow(-sinT, 1.35) : 0;
    const calfLateralCurve =
      cosT > 0 ? calfMask * 0.0038 * Math.pow(cosT, 1.5) : 0;

    // 4. Achilles tendon narrowing & ankle malleoli bony landmarks (t ≈ 0.96..1.0)
    const ankleMask = gaussian1D(clampedT, 0.99, 0.035);
    const malleolusShift =
      Math.abs(cosT) > 0.75
        ? Math.sign(cosT) * ankleMask * 0.0038 * Math.pow(Math.abs(cosT), 3)
        : 0;

    const xLocal =
      cosT * a + vastusInnerShift + calfLateralCurve + malleolusShift;
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
 * Generates exact 3D surface-hugging coordinates (+2.2mm offset) for all 50 measurement overlays
 * so `MeasurementOverlays.tsx` renders closed rings, geodesic seams, and height calipers
 * directly on the anatomically sculpted body.
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

  // ============================================================================
  // 1. ALL 17 CIRCUMFERENCE RINGS
  // ============================================================================
  addRing('head', torso.sampleClosedRing(L.yHeadMax, 56, off), 0.18);
  addRing('neck', torso.sampleClosedRing(L.yCervicale + 0.012, 52, off), 0.2);
  addRing('upperChest', torso.sampleClosedRing(L.yUpperChest, 64, off), 0.22);
  addRing('chest', torso.sampleClosedRing(L.yChest, 64, off), 0.25);
  addRing('underbust', torso.sampleClosedRing(L.yUnderbust, 64, off), 0.24);
  addRing('waist', torso.sampleClosedRing(L.yWaist, 64, off), 0.22);
  addRing('highHip', torso.sampleClosedRing(L.yHighHip, 64, off), 0.2);
  addRing('hip', torso.sampleClosedRing(L.yHip, 64, off), 0.23);

  // Leg circumference rings on left leg (+X) matching updated station T parameters
  addRing('thigh', limbs.sampleLegRing('left', 0.14, 48, off), 0.15);
  addRing('midThigh', limbs.sampleLegRing('left', 0.35, 48, off), 0.15);
  addRing('knee', limbs.sampleLegRing('left', 0.56, 44, off), 0.2);
  addRing('calf', limbs.sampleLegRing('left', 0.75, 44, off), 0.2);
  addRing('ankle', limbs.sampleLegRing('left', 1.0, 40, off), 0.2);

  // Arm circumference rings on left arm (+X) matching updated station T parameters
  addRing('bicep', limbs.sampleArmRing('left', 0.25, 44, off), 0.12);
  addRing('elbow', limbs.sampleArmRing('left', 0.48, 40, off), 0.12);
  addRing('forearm', limbs.sampleArmRing('left', 0.62, 40, off), 0.12);
  addRing('wrist', limbs.sampleArmRing('left', 0.84, 36, off), 0.15);

  // ============================================================================
  // 2. TORSO GEODESIC LINES (8 parameters)
  // ============================================================================
  // shoulderWidth: posterior arch from right shoulder tip (-X) across upper back to left shoulder tip (+X)
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

  // singleShoulderLength: left lateral neck base along trapezius ridge to left acromion tip
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

  // acrossFrontWidth: anterior curve across upperChest from right armhole to left armhole
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

  // acrossBackWidth: posterior curve across upperChest from right back armhole to left back armhole
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

  // frontWaistLength: left neck base over anterior bust apex down to anterior waist
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

  // backWaistLength: C7 center-back spine down to posterior waist
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

  // sideTorsoLength: right lateral armpit down to natural waist (on -X side)
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

  // torsoLoop: full vertical trunk loop from right shoulder down front through crotch and up back
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

  // ============================================================================
  // 3. SLEEVE GEODESIC LINES (4 parameters)
  // ============================================================================
  // sleeveFromShoulder: outer sleeve seam from left acromion tip (t=0.08) over outer elbow to wrist (t=0.84)
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

  // sleeveFromNeck: center-back C7 neck over shoulder tip down outer arm to wrist (on right arm -X)
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

  // sleeveFromArmpit: inner underarm sleeve seam from armpit (t=0.14, angle=π) to inner wrist (t=0.84)
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

  // shoulderToElbow: acromion shoulder tip (t=0.08) to outer elbow (t=0.48) on right arm
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

  // ============================================================================
  // 4. LEGS & RISE GEODESIC LINES (7 parameters)
  // ============================================================================
  // outseamFromWaist: lateral waist down outer hip and outer left leg to ankle
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

  // outseamFromHighHip: lateral high-hip down outer right leg (-X) to ankle
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

  // inseamLength: medial inner leg seam from crotch (t=0.07) down to inner ankle (t=1.0) on left leg
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

  // waistToKneeLength: lateral right waist (-X) down outer thigh to mid-knee (t=0.56)
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

  // frontRise: center-front waist down abdominal/pubic curve to perineal crotch point
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

  // backRise: center-back waist over gluteal contour to perineal crotch point
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

  // crotchCurveTotal: full front-to-back saddle curve
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

  // ============================================================================
  // 5. EXTREMITIES LINES (4 parameters)
  // ============================================================================
  // handLength: dorsal wrist to middle fingertip on left hand
  {
    const pts: THREE.Vector3[] = [];
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = THREE.MathUtils.lerp(0.84, 1.0, i / steps);
      pts.push(limbs.sampleArmPoint('left', t, 0, off * 1.4));
    }
    addLine('handLength', pts, false, 0.5);
  }

  // handWidth: transverse width across knuckles (t=0.93) on left hand
  {
    const p1 = limbs.sampleArmPoint('left', 0.93, Math.PI * 0.5, off * 1.4);
    const pMid = limbs.sampleArmPoint('left', 0.93, 0, off * 1.6);
    const p2 = limbs.sampleArmPoint('left', 0.93, Math.PI * 1.5, off * 1.4);
    addLine('handWidth', [p1, pMid, p2], false, 0.5);
  }

  // footLength: heel to longest toe along lateral sole of left foot
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

  // footWidth: transverse ball breadth across metatarsals of left foot
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

  // ============================================================================
  // 6. HEIGHTS CALIPERS (10 parameters)
  // ============================================================================
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
