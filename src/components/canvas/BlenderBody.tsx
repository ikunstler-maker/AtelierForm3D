import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { Gender } from '../../data/measurementsSchema';
import { useAtelierStore } from '../../store/useAtelierStore';
import {
  BlenderBodyCalibration,
  solveBlenderBodyWeights,
} from '../../utils/blenderBodySolver';

const modelUrl = (gender: Gender) => `./models/sims_${gender}_mannequin.glb`;
const calibrationUrl = (gender: Gender) =>
  `./models/sims_${gender}_mannequin.calibration.json`;

/**
 * Mannequin built in Blender (GLB, meters, Y-up). Its shape keys are calibrated
 * in centimeters, so the body follows the measurements from the store.
 * Beta: drives total height, neck, chest, waist and hip only.
 */
export const BlenderBody: React.FC = () => {
  const gender = useAtelierStore((s) => s.gender);
  const totalHeight = useAtelierStore((s) => s.measurements.totalHeight);
  const neck = useAtelierStore((s) => s.measurements.neck);
  const chest = useAtelierStore((s) => s.measurements.chest);
  const waist = useAtelierStore((s) => s.measurements.waist);
  const hip = useAtelierStore((s) => s.measurements.hip);
  const theme = useAtelierStore((s) => s.glassSettings.theme);
  const surfaceFinish = useAtelierStore((s) => s.glassSettings.surfaceFinish);
  const animeStyleEnabled = useAtelierStore(
    (s) => s.appearance.animeStyleEnabled
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

  const meshes = useMemo(() => {
    const list: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) list.push(obj as THREE.Mesh);
    });
    return list;
  }, [scene]);

  const material = useMemo(() => {
    const baseColor = animeStyleEnabled
      ? skinToneHex
      : theme === 'light'
      ? '#f4f5f7'
      : '#d4dce8';
    const isTranslucent = surfaceFinish === 'translucent';
    return new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: surfaceFinish === 'satin' ? 0.32 : 0.72,
      metalness: 0.03,
      clearcoat: surfaceFinish === 'satin' ? 0.36 : 0.08,
      clearcoatRoughness: 0.26,
      transparent: isTranslucent,
      opacity: isTranslucent ? 0.36 : 1,
      depthWrite: !isTranslucent,
    });
  }, [animeStyleEnabled, skinToneHex, theme, surfaceFinish]);

  useEffect(() => {
    meshes.forEach((mesh) => {
      mesh.material = material;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Morphed bodies can outgrow the bounding sphere of the base shape.
      mesh.frustumCulled = false;
    });
    return () => material.dispose();
  }, [meshes, material]);

  useEffect(() => {
    if (!calibration || calibration.gender !== gender) return;
    const weights = solveBlenderBodyWeights(calibration, {
      totalHeight,
      neck,
      chest,
      waist,
      hip,
    });
    meshes.forEach((mesh) => {
      const dict = mesh.morphTargetDictionary;
      const influences = mesh.morphTargetInfluences;
      if (!dict || !influences) return;
      influences.fill(0);
      Object.entries(weights).forEach(([name, value]) => {
        const index = dict[name];
        if (index !== undefined) influences[index] = value;
      });
    });
    scene.userData.blenderBodyWeights = weights;  }, [calibration, gender, scene, meshes, totalHeight, neck, chest, waist, hip]);

  return <primitive object={scene} name="blender-mannequin" />;
};

useGLTF.preload(modelUrl('female'));
