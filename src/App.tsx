import React, { useEffect } from 'react';
import { MannequinScene } from './components/canvas/MannequinScene';
import { CameraControlsHUD } from './components/ui/CameraControlsHUD';
import { FitCheckPanel } from './components/ui/FitCheckPanel';
import { GlassCustomizer } from './components/ui/GlassCustomizer';
import { GlassHeader } from './components/ui/GlassHeader';
import { MeasurementsPanel } from './components/ui/MeasurementsPanel';
import { useAtelierStore } from './store/useAtelierStore';

export const App: React.FC = () => {
  const glassSettings = useAtelierStore((s) => s.glassSettings);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', glassSettings.theme);
    root.style.setProperty('--glass-blur', `${glassSettings.blurPx}px`);
    root.style.setProperty('--glass-opacity', String(glassSettings.opacity));
    root.style.setProperty('--accent-primary', glassSettings.accentHex);
    root.style.setProperty('--accent-rgb', glassSettings.accentRgb);
  }, [glassSettings]);

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none">
      {/* Full-Viewport Interactive 3D Studio Canvas */}
      <MannequinScene />

      {/* Top Floating Liquid Glass Bar */}
      <GlassHeader />

      {/* Left Collapsible 50-Parameter Anthropometric Inspector */}
      <MeasurementsPanel />

      {/* Right Toggleable Garment Size Verification Panel */}
      <FitCheckPanel />

      {/* Real-time Liquid Glass & Surface Shader Customizer Popover */}
      <GlassCustomizer />

      {/* Bottom Floating Camera Presets & Auto-Focus Pill HUD */}
      <CameraControlsHUD />
    </main>
  );
};

export default App;
