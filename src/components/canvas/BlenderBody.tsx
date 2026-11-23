import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { Gender, MeasurementKey } from '../../data/measurementsSchema';
import {
  DEFAULT_SKIN_TEXTURE,
  useAtelierStore,
} from '../../store/useAtelierStore';
import {
  BlenderBodyCalibration,
  solveBlenderBodyWeights,
} from '../../utils/blenderBodySolver';

export type BlenderBodyVariant = 'anime' | 'realistic';

const stem = (gender: Gender, variant: BlenderBodyVariant) =>
  `./models/body_${gender}${variant === 'realistic' ? '_realistic' : ''}`;
const modelUrl = (gender: Gender, variant: BlenderBodyVariant) =>
  `${stem(gender, variant)}.glb`;
const calibrationUrl = (gender: Gender, variant: BlenderBodyVariant) =>
  `${stem(gender, variant)}.calibration.json`;

const EYE_MATERIAL_NAME = 'Eye';
const SKIN_GRAIN_REPEAT = 14;

let skinGrainTexture: THREE.CanvasTexture | null = null;

/** Tileable fine grain (pores) used as a bump map; generated once, no image files. */
function getSkinGrainTexture(): THREE.CanvasTexture {
  if (skinGrainTexture) return skinGrainTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, size, size);
  // Deterministic pseudo-random numbers keep the texture identical between visits.
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 5200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.6 + rand() * 1.5;
    const shade = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.05 + rand() * 0.11})`;
    // Draw each dot on all wrapped positions so the tile has no visible border.
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(SKIN_GRAIN_REPEAT, SKIN_GRAIN_REPEAT);
  skinGrainTexture = texture;
  return texture;
}

/** Last solved state, read by the slider audit (scripts and docs/reports/slider_audit.md). */
export const blenderBodyDebug: {
  model: string | null;
  weights: Record<string, number>;
} = { model: null, weights: {} };

interface NormalCache {
  base: Float32Array;
  deltas: Float32Array[];
  index: ArrayLike<number>;
  /** Vertices split by the exporter (UV seams) share one normal: vertex -> group id. */
  group: Uint32Array;
  groupCount: number;
  normal: THREE.BufferAttribute;
}

function readVec3(attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const out = new Float32Array(attr.count * 3);
  for (let i = 0; i < attr.count; i++) {
    out[i * 3] = attr.getX(i);
    out[i * 3 + 1] = attr.getY(i);
    out[i * 3 + 2] = attr.getZ(i);
  }
  return out;
}

function buildNormalCache(mesh: THREE.Mesh): NormalCache | null {
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  const morphs = geometry.morphAttributes.position;
  if (!position || !morphs || !geometry.index) return null;
  const base = readVec3(position);
  const keyToGroup = new Map<string, number>();
  const group = new Uint32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const key = `${base[i * 3]},${base[i * 3 + 1]},${base[i * 3 + 2]}`;
    let id = keyToGroup.get(key);
    if (id === undefined) {
      id = keyToGroup.size;
      keyToGroup.set(key, id);
    }
    group[i] = id;
  }
  const normal = new THREE.BufferAttribute(new Float32Array(position.count * 3), 3);
  normal.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('normal', normal);
  // Per-key normals are not shipped; make sure the shader does not expect them.
  delete geometry.morphAttributes.normal;
  return {
    base,
    deltas: morphs.map((m) => readVec3(m)),
    index: geometry.index.array,
    group,
    groupCount: keyToGroup.size,
    normal,
  };
}

/**
 * The GLBs carry no normals for shape keys (that would double the files), so smooth
 * normals are recomputed here from the morphed positions whenever the weights change.
 */
function updateMorphedNormals(mesh: THREE.Mesh) {
  let cache = mesh.userData.atelierNormals as NormalCache | null | undefined;
  if (cache === undefined) {
    cache = buildNormalCache(mesh);
    mesh.userData.atelierNormals = cache;
  }
  if (!cache) return;
  const { base, deltas, index, group, groupCount, normal } = cache;
  const influences = mesh.morphTargetInfluences ?? [];
  const pos = new Float32Array(base);
  deltas.forEach((delta, k) => {
    const w = influences[k] ?? 0;
    if (!w) return;
    for (let i = 0; i < pos.length; i++) pos[i] += delta[i] * w;
  });
  const sum = new Float32Array(groupCount * 3);
  for (let f = 0; f < index.length; f += 3) {
    const a = index[f] * 3;
    const b = index[f + 1] * 3;
    const c = index[f + 2] * 3;
    const e1x = pos[b] - pos[a];
    const e1y = pos[b + 1] - pos[a + 1];
    const e1z = pos[b + 2] - pos[a + 2];
    const e2x = pos[c] - pos[a];
    const e2y = pos[c + 1] - pos[a + 1];
    const e2z = pos[c + 2] - pos[a + 2];
    // Cross product: its length is twice the face area, so big faces weigh more.
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const v of [index[f], index[f + 1], index[f + 2]]) {
      const g = group[v] * 3;
      sum[g] += nx;
      sum[g + 1] += ny;
      sum[g + 2] += nz;
    }
  }
  const out = normal.array as Float32Array;
  for (let i = 0; i < group.length; i++) {
    const g = group[i] * 3;
    const len = Math.hypot(sum[g], sum[g + 1], sum[g + 2]) || 1;
    out[i * 3] = sum[g] / len;
    out[i * 3 + 1] = sum[g + 1] / len;
    out[i * 3 + 2] = sum[g + 2] / len;
  }
  normal.needsUpdate = true;
}

/**
 * Mannequin built in Blender (GLB, meters, Y-up) on the Blender Studio Human
 * Base Meshes (CC0). Its shape keys are calibrated in centimeters and driven by
 * the measurements listed in its calibration file (realistic: 9 measures, exact;
 * anime: 5 measures, softened). See blenderBodySolver.ts.
 */
export const BlenderBody: React.FC<{ variant: BlenderBodyVariant }> = ({
  variant,
}) => {
  const gender = useAtelierStore((s) => s.gender);
  const measurements = useAtelierStore((s) => s.measurements);
  const surfaceFinish = useAtelierStore((s) => s.glassSettings.surfaceFinish);
  const skinTexture = useAtelierStore(
    (s) => s.glassSettings.skinTexture ?? DEFAULT_SKIN_TEXTURE
  );
  const skinToneHex = useAtelierStore((s) => s.appearance.skinToneHex);
  const bodyShape = useAtelierStore((s) => s.glassSettings.bodyShape);

  const { scene } = useGLTF(modelUrl(gender, variant));
  const [calibration, setCalibration] =
    useState<BlenderBodyCalibration | null>(null);
  const expectedModel = modelUrl(gender, variant).split('/').pop();

  useEffect(() => {
    let cancelled = false;
    setCalibration(null);
    fetch(calibrationUrl(gender, variant))
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: BlenderBodyCalibration) => {
        if (!cancelled) setCalibration(data);
      })
      .catch((err) => {
        console.error('Blender body calibration failed to load', err);
      });
    return () => {
      cancelled = true;
    };
  }, [gender, variant]);

  // Remember which part every mesh is (skin or eye) before materials are replaced.
  const parts = useMemo(() => {
    const list: { mesh: THREE.Mesh; isEye: boolean }[] = [];
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.userData.atelierPart === undefined) {
        const source = Array.isArray(mesh.material)
          ? mesh.material[0]
          : mesh.material;
        mesh.userData.atelierPart =
          source?.name === EYE_MATERIAL_NAME ? 'eye' : 'skin';
      }
      list.push({ mesh, isEye: mesh.userData.atelierPart === 'eye' });
    });
    return list;
  }, [scene]);

  const skinMaterial = useMemo(() => {
    const isTranslucent = surfaceFinish === 'translucent';
    const isSatin = surfaceFinish === 'satin';
    const color = new THREE.Color(skinToneHex);
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: isSatin ? 0.38 : 0.62,
      metalness: 0,
      clearcoat: isSatin ? 0.3 : 0.05,
      clearcoatRoughness: 0.4,
      // Soft velvet rim typical for skin; grows with the texture setting.
      sheen: 0.25 + 0.45 * skinTexture,
      sheenRoughness: 0.55,
      sheenColor: color.clone().lerp(new THREE.Color('#ffb199'), 0.35),
      bumpMap: skinTexture > 0.01 ? getSkinGrainTexture() : null,
      bumpScale: 0.9 * skinTexture,
      transparent: isTranslucent,
      opacity: isTranslucent ? 0.36 : 1,
      depthWrite: !isTranslucent,
    });
  }, [skinToneHex, surfaceFinish, skinTexture]);

  const eyeMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#1a1e29',
        roughness: 0.12,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      }),
    []
  );

  useEffect(() => {
    parts.forEach(({ mesh, isEye }) => {
      mesh.material = isEye ? eyeMaterial : skinMaterial;
      mesh.castShadow = true;
      mesh.receiveShadow = !isEye;
      // Morphed bodies can outgrow the bounding sphere of the base shape.
      mesh.frustumCulled = false;
    });
    return () => skinMaterial.dispose();
  }, [parts, skinMaterial, eyeMaterial]);

  useEffect(() => {
    // Skip a calibration that belongs to the previous gender or variant.
    if (!calibration || calibration.model !== expectedModel) return;
    const targets: Record<string, number> = {
      totalHeight: measurements.totalHeight,
    };
    calibration.girthOrder.forEach((name) => {
      targets[name] = measurements[name as MeasurementKey];
    });
    const weights = solveBlenderBodyWeights(calibration, targets, bodyShape);
    parts.forEach(({ mesh }) => {
      const dict = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      if (!dict || !influences) return;
      influences.fill(0);
      Object.entries(weights).forEach(([name, value]) => {
        const index = dict[name];
        if (index !== undefined) influences[index] = value;
      });
      updateMorphedNormals(mesh);
    });
    scene.userData.blenderBodyWeights = weights;
    blenderBodyDebug.model = calibration.model;
    blenderBodyDebug.weights = weights;
  }, [calibration, expectedModel, scene, parts, measurements, bodyShape]);

  return <primitive object={scene} name="blender-mannequin" />;
};
