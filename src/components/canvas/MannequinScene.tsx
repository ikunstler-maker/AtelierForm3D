import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { CameraFocusZone } from '../../data/measurementsSchema';
import { useAtelierStore } from '../../store/useAtelierStore';
import { CM_TO_M } from '../../utils/geometryMath';
import { MeasurementOverlays } from './MeasurementOverlays';
import { ParametricBody } from './ParametricBody';

interface CameraRigTarget {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

function getCameraPresetTarget(
  preset: CameraFocusZone,
  totalHeightCm: number
): CameraRigTarget {
  const h = totalHeightCm * CM_TO_M;
  switch (preset) {
    case 'torso':
      return {
        position: new THREE.Vector3(0.0, h * 0.68, 1.38),
        target: new THREE.Vector3(0.0, h * 0.66, 0.0),
      };
    case 'sleeves':
      return {
        position: new THREE.Vector3(0.85, h * 0.64, 1.35),
        target: new THREE.Vector3(0.18, h * 0.62, 0.0),
      };
    case 'legs':
      return {
        position: new THREE.Vector3(0.18, h * 0.36, 1.55),
        target: new THREE.Vector3(0.0, h * 0.34, 0.0),
      };
    case 'back':
      return {
        position: new THREE.Vector3(0.0, h * 0.64, -1.95),
        target: new THREE.Vector3(0.0, h * 0.58, 0.0),
      };
    case 'full':
    default:
      return {
        position: new THREE.Vector3(0.28, h * 0.56, 2.38),
        target: new THREE.Vector3(0.0, h * 0.52, 0.0),
      };
  }
}

const CameraTransitionController: React.FC<{
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}> = ({ controlsRef }) => {
  const { camera } = useThree();
  const cameraPreset = useAtelierStore((s) => s.cameraPreset);
  const cameraTriggerCount = useAtelierStore((s) => s.cameraTriggerCount);
  const totalHeight = useAtelierStore((s) => s.measurements.totalHeight);

  const isAnimatingRef = useRef(false);
  const desiredPosRef = useRef(new THREE.Vector3(0.28, 0.95, 2.38));
  const desiredTargetRef = useRef(new THREE.Vector3(0, 0.88, 0));

  useEffect(() => {
    const { position, target } = getCameraPresetTarget(cameraPreset, totalHeight);
    desiredPosRef.current.copy(position);
    desiredTargetRef.current.copy(target);
    isAnimatingRef.current = true;
  }, [cameraPreset, cameraTriggerCount, totalHeight]);

  useFrame((_, delta) => {
    if (!isAnimatingRef.current || !controlsRef.current) return;

    const step = 1 - Math.exp(-6.5 * delta);
    camera.position.lerp(desiredPosRef.current, step);
    controlsRef.current.target.lerp(desiredTargetRef.current, step);
    controlsRef.current.update();

    const posDist = camera.position.distanceTo(desiredPosRef.current);
    const targetDist = controlsRef.current.target.distanceTo(desiredTargetRef.current);
    if (posDist < 0.004 && targetDist < 0.004) {
      isAnimatingRef.current = false;
    }
  });

  // Stop automated transition immediately when user grabs the orbit controls
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const stopAnimation = () => {
      isAnimatingRef.current = false;
    };
    controls.addEventListener('start', stopAnimation);
    return () => {
      controls.removeEventListener('start', stopAnimation);
    };
  }, [controlsRef]);

  return null;
};

const StudioPedestal: React.FC = () => {
  const theme = useAtelierStore((s) => s.glassSettings.theme);
  const accentHex = useAtelierStore((s) => s.glassSettings.accentHex);
  const isLight = theme === 'light';

  return (
    <group position={[0, -0.002, 0]}>
      {/* Architectural calibration platform disc */}
      <mesh position={[0, -0.014, 0]} receiveShadow>
        <cylinderGeometry args={[0.56, 0.62, 0.024, 64]} />
        <meshStandardMaterial
          color={isLight ? '#cfd8e6' : '#161c28'}
          roughness={0.5}
          metalness={0.2}
        />
      </mesh>

      {/* Precision concentric tailoring rings on top of plinth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]}>
        <ringGeometry args={[0.38, 0.384, 64]} />
        <meshBasicMaterial color={accentHex} transparent opacity={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]}>
        <ringGeometry args={[0.54, 0.544, 64]} />
        <meshBasicMaterial
          color={isLight ? '#64748b' : '#94a3b8'}
          transparent
          opacity={0.28}
        />
      </mesh>

      {/* Subtle radial studio floor grid */}
      <gridHelper
        args={[
          3.2,
          32,
          isLight ? '#94a3b8' : '#334155',
          isLight ? '#cbd5e1' : '#1e293b',
        ]}
        position={[0, -0.025, 0]}
      />
    </group>
  );
};

export const MannequinScene: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const theme = useAtelierStore((s) => s.glassSettings.theme);
  const isLight = theme === 'light';

  return (
    <div className="relative w-full h-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0.28, 0.96, 2.38], fov: 38, near: 0.05, far: 25 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        {/* Soft Studio Lighting */}
        <ambientLight intensity={isLight ? 0.85 : 0.65} />
        <hemisphereLight
          args={[
            isLight ? '#ffffff' : '#e2e8f0',
            isLight ? '#94a3b8' : '#1e293b',
            isLight ? 0.95 : 0.75,
          ]}
        />

        {/* Key Directional Light */}
        <directionalLight
          position={[2.4, 3.2, 2.6]}
          intensity={isLight ? 1.55 : 1.45}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0005}
        />

        {/* Soft Left Fill Light */}
        <directionalLight
          position={[-2.4, 2.0, 1.5]}
          intensity={isLight ? 0.75 : 0.65}
          color="#bae6fd"
        />

        {/* Back Sculptural Rim Light */}
        <directionalLight
          position={[0.4, 2.5, -2.6]}
          intensity={isLight ? 0.9 : 1.1}
          color="#f8fafc"
        />

        {/* Parametric 3D Mannequin + 3D Interactive Measurement Overlays */}
        <group position={[0, 0, 0]}>
          <ParametricBody />
          <MeasurementOverlays />
          <StudioPedestal />
          <ContactShadows
            position={[0, 0.001, 0]}
            opacity={isLight ? 0.28 : 0.48}
            scale={1.8}
            blur={2.2}
            far={1.2}
          />
        </group>

        {/* Orbit Controls with smooth damping, zoom-to-cursor, pan, and full 360 rotation */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.07}
          rotateSpeed={0.85}
          zoomSpeed={1.05}
          panSpeed={0.85}
          zoomToCursor
          minDistance={0.45}
          maxDistance={4.8}
          maxPolarAngle={Math.PI * 0.94}
          minPolarAngle={0.05}
          target={[0, 0.88, 0]}
        />

        <CameraTransitionController controlsRef={controlsRef} />
      </Canvas>
    </div>
  );
};
