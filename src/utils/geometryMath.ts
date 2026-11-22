import * as THREE from 'three';
import { Gender, MeasurementKey, MeasurementsRecord } from '../data/measurementsSchema';

export const CM_TO_M = 0.01;
export const OVERLAY_OFFSET_M = 0.0022; // +2.2mm surface offset

export interface SuperEllipseRadii {
  a: number;      // Lateral half-width (X semi-axis in meters)
  bFront: number; // Anterior half-depth (+Z semi-axis in meters)
  bBack: number;  // Posterior half-depth (-Z semi-axis in meters)
  n: number;      // Super-ellipse exponent (2.0 = ellipse, >2 = squarer anatomical boxiness)
  centerZ: number;// Sagittal offset of cross-section center (spinal lordosis / pelvic tilt in meters)
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
  ankleStanceHalfX: number;

  // Arm centerline joints (left side, +X; right side mirrors X -> -X)
  armShoulderL: THREE.Vector3;
  armpitL: THREE.Vector3;
  armBicepL: THREE.Vector3;
  armElbowL: THREE.Vector3;
  armForearmL: THREE.Vector3;
  armWristL: THREE.Vector3;
  handTipL: THREE.Vector3;

  // Leg centerline joints (left side, +X; right side mirrors X -> -X)
  legTopL: THREE.Vector3;
  legThighL: THREE.Vector3;
  legMidThighL: THREE.Vector3;
  legKneeL: THREE.Vector3;
  legCalfL: THREE.Vector3;
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
 * Given circumference C (in meters) and width-to-depth aspect ratio rho = a / b,
 * solves directly for semi-axes a (half-width) and b (half-depth).
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
 * Evaluates a point on an asymmetric anatomical super-ellipse cross-section at angle theta ∈ [0, 2π),
 * where theta = 0 is +X (left lateral), theta = π/2 is +Z (anterior front),
 * theta = π is -X (right lateral), and theta = 3π/2 is -Z (posterior back).
 */
export function sampleCrossSectionPoint(
  radii: SuperEllipseRadii,
  theta: number,
  y: number,
  radialOffsetM = 0,
  anatomicalDetail?: {
    bustFactor?: number;
    gluteFactor?: number;
    scapulaFactor?: number;
    spineGroove?: number;
    crotchIndent?: number;
    gender?: Gender;
  }
): THREE.Vector3 {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const power = 2 / Math.max(1.6, Math.min(3.2, radii.n));

  const signedPow = (val: number, p: number) =>
    Math.sign(val) * Math.pow(Math.abs(val), p);

  let x = (radii.a + radialOffsetM) * signedPow(cosT, power);
  const bRadius = sinT >= 0 ? radii.bFront : radii.bBack;
  let z = (bRadius + radialOffsetM) * signedPow(sinT, power);

  if (anatomicalDetail) {
    // 1. Bilateral bust / pectoral contour on anterior (+Z)
    if (anatomicalDetail.bustFactor && sinT > 0.1) {
      const bilateralLobing = Math.pow(Math.sin(2 * theta), 2);
      const frontMask = Math.pow(Math.max(0, sinT), 1.4);
      const sternalCleavage =
        anatomicalDetail.gender === 'female'
          ? -0.18 * Math.pow(Math.max(0, sinT), 4)
          : -0.08 * Math.pow(Math.max(0, sinT), 4);
      z +=
        anatomicalDetail.bustFactor *
        (0.65 * frontMask + 0.45 * bilateralLobing * frontMask + sternalCleavage);
    }

    // 2. Bilateral gluteal contour on posterior (-Z)
    if (anatomicalDetail.gluteFactor && sinT < -0.1) {
      const backMask = Math.pow(Math.max(0, -sinT), 1.3);
      const bilateralGlute = Math.pow(Math.sin(2 * theta), 2);
      const natalCleft = -0.22 * Math.pow(Math.max(0, -sinT), 5);
      z -=
        anatomicalDetail.gluteFactor *
        (0.6 * backMask + 0.45 * bilateralGlute * backMask + natalCleft);
    }

    // 3. Scapular / latissimus contour on upper back
    if (anatomicalDetail.scapulaFactor && sinT < 0) {
      const backMask = Math.pow(Math.max(0, -sinT), 1.5);
      z -= anatomicalDetail.scapulaFactor * backMask;
    }

    // 4. Subtle spinal groove along center-back (theta ≈ 3π/2)
    if (anatomicalDetail.spineGroove && sinT < -0.5) {
      const groove = Math.pow(Math.max(0, -sinT), 8);
      z += anatomicalDetail.spineGroove * groove;
    }

    // 5. Perineal / crotch bifurcation indentation at bottom of pelvis
    if (anatomicalDetail.crotchIndent) {
      const centerMask = Math.pow(Math.abs(sinT), 2.5);
      const scale = 1 - anatomicalDetail.crotchIndent * centerMask;
      z *= scale;
    }
  }

  return new THREE.Vector3(x, y, z + radii.centerZ);
}

/**
 * Smooth monotonic cubic Hermite interpolation (Fritsch-Carlson) over sorted 1D control stations
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

    // Binary search segment
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

    return h00 * ys[i] + h10 * h * tangents[i] + h01 * ys[i + 1] + h11 * h * tangents[i + 1];
  };
}

/**
 * Computes unified 3D anatomical landmarks from the 50 tailoring parameters.
 * Couples heights, torso lengths, rises, leg lengths, and sleeve lengths so every slider
 * produces an immediate, anatomically coherent update on the 3D mannequin.
 */
export function computeAnatomicalLandmarks(
  m: MeasurementsRecord,
  gender: Gender
): AnatomicalLandmarks {
  const yFloor = 0;
  const yCrown = m.totalHeight * CM_TO_M;

  // Couple leg heights with inseamLength, outseamFromWaist, waistToKneeLength, and rises
  const avgRiseVertM = ((m.frontRise * 0.86 + m.backRise * 0.72) * 0.5) * CM_TO_M;
  const yAnkle = Math.max(0.06, Math.min(0.11, m.totalHeight * 0.044 * CM_TO_M));

  // Crotch height responds to both crotchHeight and inseamLength
  const yCrotchRaw = (m.crotchHeight * 0.45 + (m.inseamLength + yAnkle * 100) * 0.55) * CM_TO_M;
  const yCrotch = Math.max(0.55, Math.min(yCrown * 0.54, yCrotchRaw));

  // Waist height responds to waistHeight, outseamFromWaist, and rise
  const yWaistFromOutseam = yAnkle + m.outseamFromWaist * CM_TO_M * 0.96;
  const yWaistFromRise = yCrotch + avgRiseVertM;
  const yWaistRaw =
    m.waistHeight * CM_TO_M * 0.4 +
    yWaistFromOutseam * 0.35 +
    yWaistFromRise * 0.25;
  const yWaist = Math.max(yCrotch + 0.16, Math.min(yCrown * 0.72, yWaistRaw));

  // High hip and full hip heights between crotch and waist
  const yHighHipFromOutseam = yAnkle + m.outseamFromHighHip * CM_TO_M * 0.96;
  const yHighHip = Math.max(
    yCrotch + 0.09,
    Math.min(
      yWaist - 0.04,
      m.highHipHeight * CM_TO_M * 0.5 + yHighHipFromOutseam * 0.5
    )
  );
  const yHip = Math.max(
    yCrotch + 0.035,
    Math.min(yHighHip - 0.035, m.hipHeight * CM_TO_M)
  );

  // Knee height responds to both kneeHeight and waistToKneeLength
  const yKneeFromWaist = yWaist - m.waistToKneeLength * CM_TO_M * 0.97;
  const yKnee = Math.max(
    yAnkle + 0.22,
    Math.min(yCrotch - 0.16, m.kneeHeight * CM_TO_M * 0.5 + yKneeFromWaist * 0.5)
  );

  const yThigh = yCrotch - 0.035;
  const yMidThigh = (yThigh + yKnee) * 0.5;
  const yCalf = yAnkle + (yKnee - yAnkle) * 0.63;

  // Upper torso vertical heights coupled with backWaistLength, frontWaistLength, sideTorsoLength
  const torsoVertFromBack = m.backWaistLength * CM_TO_M * 0.93;
  const torsoVertFromFront = m.frontWaistLength * CM_TO_M * 0.89;
  const torsoVertFromLoop = (m.torsoLoop * CM_TO_M * 0.46) - (yWaist - yCrotch);

  const yCervicaleRaw =
    m.cervicaleHeight * CM_TO_M * 0.4 +
    (yWaist + (torsoVertFromBack * 0.55 + torsoVertFromFront * 0.3 + torsoVertFromLoop * 0.15)) * 0.6;
  const yCervicale = Math.max(yWaist + 0.28, Math.min(yCrown - 0.18, yCervicaleRaw));

  const shoulderDropFromC7 = Math.max(
    0.04,
    Math.min(0.09, (m.cervicaleHeight - m.shoulderHeight) * CM_TO_M)
  );
  const yShoulder = yCervicale - shoulderDropFromC7;

  // Armpit height driven by sideTorsoLength
  const yArmpit = Math.max(
    yWaist + 0.13,
    Math.min(yShoulder - 0.06, yWaist + m.sideTorsoLength * CM_TO_M * 0.96)
  );

  const torsoSpan = yCervicale - yWaist;
  const yChestRatio = Math.max(
    0.28,
    Math.min(0.62, (m.chestHeight - m.waistHeight) / Math.max(20, m.cervicaleHeight - m.waistHeight))
  );
  const yChest = yWaist + torsoSpan * yChestRatio;
  const yUnderbust = Math.max(
    yWaist + 0.04,
    Math.min(yChest - 0.04, yChest - (m.chestHeight - m.underbustHeight) * CM_TO_M)
  );
  const yUpperChest = Math.min(yShoulder - 0.03, Math.max(yChest + 0.045, yArmpit + 0.015));

  // Head and neck heights
  const headSpan = Math.max(0.18, yCrown - yCervicale);
  const yNeckMid = yCervicale + headSpan * 0.16;
  const yJaw = yCervicale + headSpan * 0.32;
  const yHeadMax = yCervicale + headSpan * 0.68;

  // Shoulder & neck widths
  const neckRadii = circumferenceToEllipseAxes(m.neck * CM_TO_M, 1.08);
  const neckHalfWidth = neckRadii.a;
  const shoulderHalfFromWidth = (m.shoulderWidth * CM_TO_M) * 0.49;
  const shoulderHalfFromSeam = neckHalfWidth + m.singleShoulderLength * CM_TO_M * 0.92;
  const shoulderHalfSpan = shoulderHalfFromWidth * 0.6 + shoulderHalfFromSeam * 0.4;

  // Hip & ankle stance X
  const hipRadii = circumferenceToEllipseAxes(
    m.hip * CM_TO_M,
    gender === 'female' ? 1.38 : 1.32
  );
  const hipStanceHalfX = Math.max(0.072, hipRadii.a * 0.52);
  const ankleStanceHalfX = Math.max(0.082, hipStanceHalfX * 1.08);

  // Arm kinematics in relaxed atelier A-pose
  const armAbductionRad = THREE.MathUtils.degToRad(gender === 'female' ? 21 : 23);
  const elbowFlexForwardRad = THREE.MathUtils.degToRad(8);

  const upperArmLenM = Math.max(
    0.22,
    (m.shoulderToElbow * 0.65 + (m.sleeveFromShoulder - m.sleeveFromArmpit + 18) * 0.35) * CM_TO_M
  );
  const totalSleeveM = Math.max(
    upperArmLenM + 0.18,
    (m.sleeveFromShoulder * 0.55 +
      (m.sleeveFromNeck - m.singleShoulderLength - m.neck * 0.16) * 0.2 +
      (m.sleeveFromArmpit + (yShoulder - yArmpit) * 100) * 0.25) *
      CM_TO_M
  );
  const forearmLenM = Math.max(0.18, totalSleeveM - upperArmLenM);

  const armShoulderL = new THREE.Vector3(shoulderHalfSpan, yShoulder, -0.008);
  const armpitL = new THREE.Vector3(
    shoulderHalfSpan * 0.78,
    yArmpit,
    0.004
  );

  const upperDir = new THREE.Vector3(
    Math.sin(armAbductionRad),
    -Math.cos(armAbductionRad),
    -0.03
  ).normalize();

  const armElbowL = armShoulderL.clone().addScaledVector(upperDir, upperArmLenM);
  const armBicepL = armShoulderL.clone().lerp(armElbowL, 0.46);

  const lowerDir = new THREE.Vector3(
    Math.sin(armAbductionRad * 0.82),
    -Math.cos(armAbductionRad * 0.82),
    Math.sin(elbowFlexForwardRad)
  ).normalize();

  const armWristL = armElbowL.clone().addScaledVector(lowerDir, forearmLenM);
  const armForearmL = armElbowL.clone().lerp(armWristL, 0.38);
  const handTipL = armWristL
    .clone()
    .addScaledVector(lowerDir, m.handLength * CM_TO_M);

  // Leg centerline joints (Left side +X)
  const legTopL = new THREE.Vector3(hipStanceHalfX, yCrotch + 0.015, 0.002);
  const legThighL = new THREE.Vector3(
    THREE.MathUtils.lerp(hipStanceHalfX, ankleStanceHalfX, 0.12),
    yThigh,
    0.004
  );
  const legMidThighL = new THREE.Vector3(
    THREE.MathUtils.lerp(hipStanceHalfX, ankleStanceHalfX, 0.35),
    yMidThigh,
    0.005
  );
  const legKneeL = new THREE.Vector3(
    THREE.MathUtils.lerp(hipStanceHalfX, ankleStanceHalfX, 0.58),
    yKnee,
    0.003
  );
  const legCalfL = new THREE.Vector3(
    THREE.MathUtils.lerp(hipStanceHalfX, ankleStanceHalfX, 0.76),
    yCalf,
    -0.006
  );
  const legAnkleL = new THREE.Vector3(ankleStanceHalfX, yAnkle, -0.004);

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
    ankleStanceHalfX,
    armShoulderL,
    armpitL,
    armBicepL,
    armElbowL,
    armForearmL,
    armWristL,
    handTipL,
    legTopL,
    legThighL,
    legMidThighL,
    legKneeL,
    legCalfL,
    legAnkleL,
  };
}

export interface TorsoCrossSectionEvaluator {
  landmarks: AnatomicalLandmarks;
  evalAtY: (y: number) => {
    radii: SuperEllipseRadii;
    detail: {
      bustFactor: number;
      gluteFactor: number;
      scapulaFactor: number;
      spineGroove: number;
      crotchIndent: number;
      gender: Gender;
    };
  };
  sampleSurfacePoint: (y: number, theta: number, radialOffsetM?: number) => THREE.Vector3;
  sampleClosedRing: (y: number, segments?: number, radialOffsetM?: number) => THREE.Vector3[];
}

/**
 * Builds a continuous smooth Hermite spline evaluator for the torso, pelvis, neck, and head
 * from yCrotch up to yCrown, driven by all torso/girth/rise parameters.
 */
export function createTorsoEvaluator(
  m: MeasurementsRecord,
  gender: Gender,
  landmarks?: AnatomicalLandmarks
): TorsoCrossSectionEvaluator {
  const L = landmarks ?? computeAnatomicalLandmarks(m, gender);
  const isFemale = gender === 'female';

  // Convert key circumferences into base ellipse axes
  const hipAxes = circumferenceToEllipseAxes(m.hip * CM_TO_M, isFemale ? 1.38 : 1.31);
  const highHipAxes = circumferenceToEllipseAxes(m.highHip * CM_TO_M, isFemale ? 1.36 : 1.30);
  const waistAxes = circumferenceToEllipseAxes(m.waist * CM_TO_M, isFemale ? 1.32 : 1.28);
  const underbustAxes = circumferenceToEllipseAxes(m.underbust * CM_TO_M, isFemale ? 1.35 : 1.33);
  const chestAxes = circumferenceToEllipseAxes(m.chest * CM_TO_M, isFemale ? 1.28 : 1.36);
  const upperChestAxes = circumferenceToEllipseAxes(m.upperChest * CM_TO_M, isFemale ? 1.44 : 1.48);
  const neckAxes = circumferenceToEllipseAxes(m.neck * CM_TO_M, 1.05);
  const headAxes = circumferenceToEllipseAxes(m.head * CM_TO_M, 0.84);

  // Factor in acrossFrontWidth, acrossBackWidth, frontRise, backRise
  const acrossRatio =
    ((m.acrossFrontWidth + m.acrossBackWidth) * CM_TO_M) /
    Math.max(0.5, upperChestAxes.a * 4);
  const upperChestWidthAdjusted = upperChestAxes.a * (0.65 + 0.35 * acrossRatio);

  const frontBackChestBias =
    (m.acrossFrontWidth - m.acrossBackWidth) / Math.max(30, m.acrossFrontWidth + m.acrossBackWidth);

  const riseRatio = m.backRise / Math.max(20, m.frontRise + m.backRise); // ~0.58
  const gluteDepthBoost = Math.max(0, (riseRatio - 0.52) * 0.14);
  const frontRiseBoost = Math.max(0, (0.48 - riseRatio) * 0.1);

  // Bust prominence from difference between chest and underbust
  const bustDeltaM = Math.max(0, (m.chest - m.underbust) * CM_TO_M);
  const bustPeakFactor = isFemale
    ? Math.min(0.055, 0.012 + bustDeltaM * 0.16)
    : Math.min(0.022, 0.005 + bustDeltaM * 0.06);

  // Gluteal prominence from hip-to-waist ratio & backRise
  const hipWaistDeltaM = Math.max(0, (m.hip - m.waist) * CM_TO_M);
  const glutePeakFactor = isFemale
    ? Math.min(0.048, 0.015 + hipWaistDeltaM * 0.075 + gluteDepthBoost)
    : Math.min(0.036, 0.011 + hipWaistDeltaM * 0.055 + gluteDepthBoost);

  // Sorted vertical stations from crotch to head crown
  const stations = [
    {
      y: L.yCrotch,
      a: hipAxes.a * 0.66,
      bF: hipAxes.b * 0.62 + frontRiseBoost,
      bB: hipAxes.b * 0.68 + gluteDepthBoost * 0.5,
      n: 2.15,
      cZ: -0.004,
    },
    {
      y: L.yHip,
      a: hipAxes.a,
      bF: hipAxes.b * (isFemale ? 0.91 : 0.94) + frontRiseBoost,
      bB: hipAxes.b * (isFemale ? 1.11 : 1.06) + gluteDepthBoost,
      n: 2.22,
      cZ: -0.008,
    },
    {
      y: L.yHighHip,
      a: highHipAxes.a,
      bF: highHipAxes.b * 0.96,
      bB: highHipAxes.b * 1.04,
      n: 2.2,
      cZ: -0.003,
    },
    {
      y: L.yWaist,
      a: waistAxes.a,
      bF: waistAxes.b * 0.98,
      bB: waistAxes.b * 1.02,
      n: 2.12,
      cZ: 0.005,
    },
    {
      y: L.yUnderbust,
      a: underbustAxes.a,
      bF: underbustAxes.b * 1.0,
      bB: underbustAxes.b * 1.0,
      n: 2.2,
      cZ: 0.003,
    },
    {
      y: L.yChest,
      a: chestAxes.a,
      bF: chestAxes.b * (isFemale ? 1.08 : 1.02) + frontBackChestBias * 0.03,
      bB: chestAxes.b * (isFemale ? 0.94 : 0.99) - frontBackChestBias * 0.03,
      n: 2.26,
      cZ: 0.001,
    },
    {
      y: L.yUpperChest,
      a: upperChestWidthAdjusted,
      bF: upperChestAxes.b * 0.97 + frontBackChestBias * 0.025,
      bB: upperChestAxes.b * 1.03 - frontBackChestBias * 0.025,
      n: 2.38,
      cZ: -0.003,
    },
    {
      y: L.yShoulder,
      a: L.shoulderHalfSpan * 0.96,
      bF: neckAxes.b * 1.32,
      bB: neckAxes.b * 1.48,
      n: 2.45,
      cZ: -0.007,
    },
    {
      y: L.yCervicale,
      a: neckAxes.a * 1.06,
      bF: neckAxes.b * 1.02,
      bB: neckAxes.b * 1.06,
      n: 2.05,
      cZ: -0.003,
    },
    {
      y: L.yNeckMid,
      a: neckAxes.a * 0.96,
      bF: neckAxes.b * 0.96,
      bB: neckAxes.b * 0.96,
      n: 2.0,
      cZ: 0.002,
    },
    {
      y: L.yJaw,
      a: headAxes.a * 0.78,
      bF: headAxes.b * 0.88,
      bB: headAxes.b * 0.82,
      n: 2.05,
      cZ: 0.01,
    },
    {
      y: L.yHeadMax,
      a: headAxes.a,
      bF: headAxes.b * 1.02,
      bB: headAxes.b * 0.98,
      n: 2.08,
      cZ: 0.006,
    },
    {
      y: L.yCrown - 0.015,
      a: headAxes.a * 0.52,
      bF: headAxes.b * 0.52,
      bB: headAxes.b * 0.52,
      n: 2.0,
      cZ: 0.003,
    },
    {
      y: L.yCrown,
      a: 0.006,
      bF: 0.006,
      bB: 0.006,
      n: 2.0,
      cZ: 0.002,
    },
  ];

  // Ensure strictly increasing Y for Hermite interpolation
  for (let i = 1; i < stations.length; i++) {
    if (stations[i].y <= stations[i - 1].y + 0.004) {
      stations[i].y = stations[i - 1].y + 0.004;
    }
  }

  const ys = stations.map((s) => s.y);
  const interpA = createMonotoneHermiteInterpolator(ys, stations.map((s) => s.a));
  const interpBF = createMonotoneHermiteInterpolator(ys, stations.map((s) => s.bF));
  const interpBB = createMonotoneHermiteInterpolator(ys, stations.map((s) => s.bB));
  const interpN = createMonotoneHermiteInterpolator(ys, stations.map((s) => s.n));
  const interpCZ = createMonotoneHermiteInterpolator(ys, stations.map((s) => s.cZ));

  const gaussianWindow = (y: number, center: number, sigma: number) => {
    const d = (y - center) / Math.max(0.01, sigma);
    return Math.exp(-0.5 * d * d);
  };

  const evalAtY = (y: number) => {
    const radii: SuperEllipseRadii = {
      a: Math.max(0.004, interpA(y)),
      bFront: Math.max(0.004, interpBF(y)),
      bBack: Math.max(0.004, interpBB(y)),
      n: interpN(y),
      centerZ: interpCZ(y),
    };

    const bustSpread = isFemale
      ? (L.yUpperChest - L.yUnderbust) * 0.42
      : (L.yUpperChest - L.yUnderbust) * 0.55;
    const bustFactor = bustPeakFactor * gaussianWindow(y, L.yChest, bustSpread);

    const gluteSpread = (L.yHighHip - L.yCrotch) * 0.45;
    const gluteFactor = glutePeakFactor * gaussianWindow(y, L.yHip, gluteSpread);

    const scapulaFactor = 0.011 * gaussianWindow(y, L.yUpperChest, 0.075);
    const spineGroove =
      y > L.yHip && y < L.yCervicale
        ? 0.007 * Math.sin(((y - L.yHip) / (L.yCervicale - L.yHip)) * Math.PI)
        : 0;

    const crotchSpan = Math.max(0.03, L.yHip - L.yCrotch);
    const crotchIndent =
      y < L.yHip ? 0.32 * Math.pow(Math.max(0, 1 - (y - L.yCrotch) / crotchSpan), 2) : 0;

    return {
      radii,
      detail: {
        bustFactor,
        gluteFactor,
        scapulaFactor,
        spineGroove,
        crotchIndent,
        gender,
      },
    };
  };

  const sampleSurfacePoint = (y: number, theta: number, radialOffsetM = 0) => {
    const { radii, detail } = evalAtY(y);
    return sampleCrossSectionPoint(radii, theta, y, radialOffsetM, detail);
  };

  const sampleClosedRing = (y: number, segments = 64, radialOffsetM = OVERLAY_OFFSET_M) => {
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
 * Evaluates a point on the left (+X) or right (-X) arm & hand at parameter t ∈ [0, 1]
 * where t=0 is shoulder junction, t=0.22 is bicep, t=0.48 is elbow, t=0.66 is forearm,
 * t=0.84 is wrist, and t=1.0 is fingertip.
 */
export function createLimbEvaluators(
  m: MeasurementsRecord,
  gender: Gender,
  landmarks?: AnatomicalLandmarks
) {
  const L = landmarks ?? computeAnatomicalLandmarks(m, gender);

  // Arm radii at key stations
  const shoulderCapAxes = circumferenceToEllipseAxes(m.bicep * 1.18 * CM_TO_M, 0.92);
  const bicepAxes = circumferenceToEllipseAxes(m.bicep * CM_TO_M, 0.96);
  const elbowAxes = circumferenceToEllipseAxes(m.elbow * CM_TO_M, 1.04);
  const forearmAxes = circumferenceToEllipseAxes(m.forearm * CM_TO_M, 1.08);
  const wristAxes = circumferenceToEllipseAxes(m.wrist * CM_TO_M, 1.28);
  const handPalmA = (m.handWidth * CM_TO_M) * 0.5;
  const handPalmB = wristAxes.b * 0.78;

  const armStationsT = [0, 0.22, 0.48, 0.65, 0.84, 0.92, 0.985, 1.0];
  const armCurveL = new THREE.CatmullRomCurve3([
    L.armShoulderL,
    L.armBicepL,
    L.armElbowL,
    L.armForearmL,
    L.armWristL,
    L.armWristL.clone().lerp(L.handTipL, 0.48),
    L.armWristL.clone().lerp(L.handTipL, 0.9),
    L.handTipL,
  ]);

  const interpArmA = createMonotoneHermiteInterpolator(armStationsT, [
    shoulderCapAxes.a,
    bicepAxes.a,
    elbowAxes.a,
    forearmAxes.a,
    wristAxes.a,
    handPalmA,
    handPalmA * 0.58,
    0.004,
  ]);
  const interpArmB = createMonotoneHermiteInterpolator(armStationsT, [
    shoulderCapAxes.b,
    bicepAxes.b,
    elbowAxes.b,
    forearmAxes.b,
    wristAxes.b,
    handPalmB,
    handPalmB * 0.55,
    0.003,
  ]);

  const sampleArmPoint = (
    side: 'left' | 'right',
    t: number,
    angleRad: number,
    radialOffsetM = 0
  ): THREE.Vector3 => {
    const clampedT = Math.max(0, Math.min(1, t));
    const centerL = armCurveL.getPoint(clampedT);
    const tangentL = armCurveL.getTangent(clampedT).normalize();

    // Local frame: normal1 pointing forward (+Z), normal2 pointing outward laterally
    const forwardRef = new THREE.Vector3(0, 0, 1);
    const latOutL = new THREE.Vector3().crossVectors(tangentL, forwardRef).normalize();
    const antForward = new THREE.Vector3().crossVectors(latOutL, tangentL).normalize();

    const a = interpArmA(clampedT) + radialOffsetM;
    const b = interpArmB(clampedT) + radialOffsetM;

    const localOut = Math.cos(angleRad) * a;
    const localAnt = Math.sin(angleRad) * b;

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

  // Leg radii at key stations (from hip/crotch junction down to ankle)
  const thighAxes = circumferenceToEllipseAxes(m.thigh * CM_TO_M, 0.94);
  const midThighAxes = circumferenceToEllipseAxes(m.midThigh * CM_TO_M, 0.96);
  const kneeAxes = circumferenceToEllipseAxes(m.knee * CM_TO_M, 0.98);
  const calfAxes = circumferenceToEllipseAxes(m.calf * CM_TO_M, 0.95);
  const ankleAxes = circumferenceToEllipseAxes(m.ankle * CM_TO_M, 0.92);

  const legStationsT = [0, 0.1, 0.32, 0.54, 0.75, 1.0];
  const legCurveL = new THREE.CatmullRomCurve3([
    L.legTopL,
    L.legThighL,
    L.legMidThighL,
    L.legKneeL,
    L.legCalfL,
    L.legAnkleL,
  ]);

  const interpLegA = createMonotoneHermiteInterpolator(legStationsT, [
    thighAxes.a * 1.03,
    thighAxes.a,
    midThighAxes.a,
    kneeAxes.a,
    calfAxes.a,
    ankleAxes.a,
  ]);
  const interpLegB = createMonotoneHermiteInterpolator(legStationsT, [
    thighAxes.b * 1.05,
    thighAxes.b,
    midThighAxes.b,
    kneeAxes.b,
    calfAxes.b,
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

    // Gastrocnemius posterior calf contour around t=0.75
    const calfMask = Math.exp(-Math.pow((clampedT - 0.74) / 0.11, 2));
    const sinT = Math.sin(angleRad);
    const calfBackBulge = sinT < 0 ? -0.008 * calfMask * Math.pow(-sinT, 1.5) : 0;

    const xLocal = Math.cos(angleRad) * a;
    const zLocal = Math.sin(angleRad) * b + calfBackBulge;

    const pt = new THREE.Vector3(centerL.x + xLocal, centerL.y, centerL.z + zLocal);
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
 * Generates exact 3D surface-hugging coordinates (+2mm offset) for all 50 measurement overlays
 * so `MeasurementOverlays.tsx` can render closed rings, geodesic seams, and height calipers.
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

  // Helper to add a closed circumference ring
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

  // Helper to add an open geodesic polyline
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

  // Leg circumference rings on left leg (+X)
  addRing('thigh', limbs.sampleLegRing('left', 0.1, 48, off), 0.15);
  addRing('midThigh', limbs.sampleLegRing('left', 0.32, 48, off), 0.15);
  addRing('knee', limbs.sampleLegRing('left', 0.54, 44, off), 0.2);
  addRing('calf', limbs.sampleLegRing('left', 0.75, 44, off), 0.2);
  addRing('ankle', limbs.sampleLegRing('left', 1.0, 40, off), 0.2);

  // Arm circumference rings on left arm (+X)
  addRing('bicep', limbs.sampleArmRing('left', 0.22, 44, off), 0.12);
  addRing('elbow', limbs.sampleArmRing('left', 0.48, 40, off), 0.12);
  addRing('forearm', limbs.sampleArmRing('left', 0.65, 40, off), 0.12);
  addRing('wrist', limbs.sampleArmRing('left', 0.84, 36, off), 0.15);

  // ============================================================================
  // 2. TORSO GEODESIC LINES (8 parameters)
  // ============================================================================
  // shoulderWidth: posterior arch from right shoulder tip (-X) across upper back to left shoulder tip (+X)
  {
    const pts: THREE.Vector3[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps; // 0 (right) -> 1 (left)
      const theta = Math.PI + u * Math.PI; // π -> 2π along posterior
      const archY = L.yShoulder + Math.sin(u * Math.PI) * (L.yCervicale - L.yShoulder) * 0.75;
      pts.push(torso.sampleSurfacePoint(archY, theta, off * 1.4));
    }
    addLine('shoulderWidth', pts, false, 0.5);
  }

  // singleShoulderLength: left lateral neck base to left acromion tip
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
      const theta = THREE.MathUtils.lerp(Math.PI * 0.34, Math.PI * 0.42, Math.sin(u * Math.PI * 0.5));
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

  // sideTorsoLength: right lateral armpit down to natural waist (on -X side for clear separation)
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
    // Front descent from shoulder to crotch
    for (let i = 0; i <= halfSteps; i++) {
      const u = i / halfSteps;
      const y = THREE.MathUtils.lerp(L.yShoulder, L.yCrotch, u);
      const theta = THREE.MathUtils.lerp(Math.PI * 0.65, Math.PI * 0.52, u);
      pts.push(torso.sampleSurfacePoint(y, theta, off * 1.8));
    }
    // Back ascent from crotch to shoulder
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
  // sleeveFromShoulder: outer sleeve seam from left shoulder tip (t=0) over outer elbow to wrist (t=0.84)
  {
    const pts: THREE.Vector3[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = u * 0.84;
      pts.push(limbs.sampleArmPoint('left', t, 0, off * 1.6));
    }
    addLine('sleeveFromShoulder', pts, false, 0.52);
  }

  // sleeveFromNeck: center-back C7 neck over shoulder tip down outer arm to wrist (on right arm -X for clarity)
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
      const t = u * 0.84;
      pts.push(limbs.sampleArmPoint('right', t, 0, off * 1.7));
    }
    addLine('sleeveFromNeck', pts, false, 0.55);
  }

  // sleeveFromArmpit: inner underarm sleeve seam from armpit (t=0.08, angle=π) to inner wrist (t=0.84)
  {
    const pts: THREE.Vector3[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = THREE.MathUtils.lerp(0.08, 0.84, u);
      pts.push(limbs.sampleArmPoint('left', t, Math.PI, off * 1.6));
    }
    addLine('sleeveFromArmpit', pts, false, 0.5);
  }

  // shoulderToElbow: acromion shoulder tip (t=0) to outer elbow (t=0.48) on right arm
  {
    const pts: THREE.Vector3[] = [];
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = u * 0.48;
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
    const hipSteps = 14;
    for (let i = 0; i <= hipSteps; i++) {
      const u = i / hipSteps;
      const y = THREE.MathUtils.lerp(L.yWaist, L.yCrotch + 0.015, u);
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
    const hipSteps = 10;
    for (let i = 0; i <= hipSteps; i++) {
      const u = i / hipSteps;
      const y = THREE.MathUtils.lerp(L.yHighHip, L.yCrotch + 0.015, u);
      pts.push(torso.sampleSurfacePoint(y, Math.PI, off * 1.7));
    }
    const legSteps = 26;
    for (let i = 1; i <= legSteps; i++) {
      const u = i / legSteps;
      pts.push(limbs.sampleLegPoint('right', u, 0, off * 1.7));
    }
    addLine('outseamFromHighHip', pts, false, 0.55);
  }

  // inseamLength: medial inner leg seam from crotch (t=0.03) down to inner ankle (t=1.0) on left leg
  {
    const pts: THREE.Vector3[] = [];
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const t = THREE.MathUtils.lerp(0.03, 1.0, u);
      pts.push(limbs.sampleLegPoint('left', t, Math.PI, off * 1.7));
    }
    addLine('inseamLength', pts, false, 0.48);
  }

  // waistToKneeLength: lateral right waist (-X) down outer thigh to mid-knee (t=0.54)
  {
    const pts: THREE.Vector3[] = [];
    const hipSteps = 12;
    for (let i = 0; i <= hipSteps; i++) {
      const u = i / hipSteps;
      const y = THREE.MathUtils.lerp(L.yWaist, L.yCrotch + 0.015, u);
      pts.push(torso.sampleSurfacePoint(y, Math.PI * 0.94, off * 1.9));
    }
    const legSteps = 16;
    for (let i = 1; i <= legSteps; i++) {
      const u = (i / legSteps) * 0.54;
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
      // Curve smoothly inward to perineal saddle point at u -> 1
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

  // handWidth: transverse width across knuckles (t=0.92) on left hand
  {
    const p1 = limbs.sampleArmPoint('left', 0.92, Math.PI * 0.5, off * 1.4);
    const pMid = limbs.sampleArmPoint('left', 0.92, 0, off * 1.6);
    const p2 = limbs.sampleArmPoint('left', 0.92, Math.PI * 1.5, off * 1.4);
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
      anchorPoint: limbs.sampleLegPoint('right', 0.54, 0, off),
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
