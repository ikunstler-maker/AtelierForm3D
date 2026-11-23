import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { Gender } from '../../data/measurementsSchema';
import {
  DEFAULT_SKIN_TEXTURE,
  useAtelierStore,
} from '../../store/useAtelierStore';
import {
  BlenderBodyCalibration,
  solveBlenderBodyWeights,
} from '../../utils/blenderBodySolver';

const modelUrl = (gender: Gender) => `./models/body_${gender}.glb`;
const calibrationUrl = (gender: Gender) =>
  `./models/body_${gender}.calibration.json`;

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

/**
 * Mannequin built in Blender (GLB, meters, Y-up) on the Blender Studio Human
 * Base Meshes (CC0). Its shape keys are calibrated in centimeters and driven by
 * totalHeight, neck, chest, waist and hip from the store. The stylized (anime)
 * body softens the response; see blenderBodySolver.ts.
 */
export const BlenderBody: React.FC = () => {
  const gender = useAtelierStore((s) => s.gender);
  const totalHeight = useAtelierStore((s) => s.measurements.totalHeight);
  const neck = useAtelierStore((s) => s.measurements.neck);
  const chest = useAtelierStore((s) => s.measurements.chest);
  const waist = useAtelierStore((s) => s.measurements.waist);
  const hip = useAtelierStore((s) => s.measurements.hip);
  const surfaceFinish = useAtelierStore((s) => s.glassSettings.surfaceFinish);
  const skinTexture = useAtelierStore(
    (s) => s.glassSettings.skinTexture ?? DEFAULT_SKIN_TEXTURE
  );
  const skinToneHex = useAtelierStore((s) => s.appearance.skinToneHex);

  const { scene } = useGLTF(modelUrl(gender));
  const [calibration, setCalibration] =
    useState<BlenderBodyCalibration | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCalibration(null);
    fetch(calibrationUrl(gender))
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
  }, [gender]);

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
    if (!calibration || calibration.gender !== gender) return;
    const weights = solveBlenderBodyWeights(calibration, {
      totalHeight,
      neck,
      chest,
      waist,
      hip,
    });
    parts.forEach(({ mesh }) => {
      const dict = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      if (!dict || !influences) return;
      influences.fill(0);
      Object.entries(weights).forEach(([name, value]) => {
        const index = dict[name];
        if (index !== undefined) influences[index] = value;
      });
    });
    scene.userData.blenderBodyWeights = weights;
  }, [calibration, gender, scene, parts, totalHeight, neck, chest, waist, hip]);

  return <primitive object={scene} name="blender-mannequin" />;
};

useGLTF.preload(modelUrl('female'));
