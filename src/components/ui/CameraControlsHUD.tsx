import React from 'react';
import { CameraFocusZone } from '../../data/measurementsSchema';
import { TRANSLATIONS } from '../../data/translations';
import { useAtelierStore } from '../../store/useAtelierStore';
import {
  IconCameraBack,
  IconCameraFull,
  IconCameraLegs,
  IconCameraSleeves,
  IconCameraTorso,
  IconReset,
  IconTargetFocus,
} from '../icons/CustomIcons';

export const CameraControlsHUD: React.FC = () => {
  const cameraPreset = useAtelierStore((s) => s.cameraPreset);
  const setCameraPreset = useAtelierStore((s) => s.setCameraPreset);
  const autoFocusSelected = useAtelierStore((s) => s.autoFocusSelected);
  const setAutoFocusSelected = useAtelierStore((s) => s.setAutoFocusSelected);
  const language = useAtelierStore((s) => s.language);

  const t = TRANSLATIONS[language];

  const views: Array<{
    id: CameraFocusZone;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'full', label: t.camera.full, icon: <IconCameraFull size={15} /> },
    { id: 'torso', label: t.camera.torso, icon: <IconCameraTorso size={15} /> },
    {
      id: 'sleeves',
      label: t.camera.sleeves,
      icon: <IconCameraSleeves size={15} />,
    },
    { id: 'legs', label: t.camera.legs, icon: <IconCameraLegs size={15} /> },
    { id: 'back', label: t.camera.back, icon: <IconCameraBack size={15} /> },
  ];

  return (
    <nav
      id="camera-controls-hud"
      aria-label={t.camera.ariaLabel}
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 liquid-glass rounded-2xl px-2.5 py-1.5 flex items-center gap-1.5 max-w-[calc(100vw-24px)] overflow-x-auto glass-scroll"
    >
      {views.map((view) => {
        const isActive = cameraPreset === view.id;
        return (
          <button
            key={view.id}
            id={`camera-preset-${view.id}-btn`}
            type="button"
            onClick={() => setCameraPreset(view.id)}
            title={view.label}
            aria-label={view.label}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              isActive ? 'liquid-glass-pill-active' : 'liquid-glass-pill opacity-80'
            }`}
          >
            {view.icon}
            <span className="hidden sm:inline">{view.label}</span>
          </button>
        );
      })}

      <div className="h-4 w-[1px] bg-white/15 mx-0.5 shrink-0" />

      {/* Reset Orbit Button */}
      <button
        id="camera-reset-orbit-btn"
        type="button"
        onClick={() => setCameraPreset('full')}
        title={t.camera.reset}
        aria-label={t.camera.reset}
        className="liquid-glass-pill px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-medium whitespace-nowrap opacity-85 hover:opacity-100"
      >
        <IconReset size={14} />
        <span className="hidden md:inline">{t.camera.reset}</span>
      </button>

      {/* Auto-Focus Selected Toggle */}
      <button
        id="camera-autofocus-toggle-btn"
        type="button"
        onClick={() => setAutoFocusSelected(!autoFocusSelected)}
        title={t.camera.autoFocus}
        aria-label={t.camera.autoFocus}
        aria-pressed={autoFocusSelected}
        className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-medium whitespace-nowrap transition-all ${
          autoFocusSelected
            ? 'liquid-glass-pill-active'
            : 'liquid-glass-pill opacity-65'
        }`}
      >
        <IconTargetFocus size={14} />
        <span className="hidden lg:inline">{t.camera.autoFocus}</span>
      </button>
    </nav>
  );
};
