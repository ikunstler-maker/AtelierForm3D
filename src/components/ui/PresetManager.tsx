import React, { useEffect, useState } from 'react';
import { TRANSLATIONS } from '../../data/translations';
import { isUserPresetId, useAtelierStore } from '../../store/useAtelierStore';

type Mode = 'idle' | 'save' | 'rename' | 'confirmDelete';

const BTN =
  'liquid-glass-pill px-2.5 py-1.5 rounded-xl text-xs font-medium opacity-90 hover:opacity-100';

/** Save / update / rename / delete controls for the user's own body presets. */
export const PresetManager: React.FC = () => {
  const language = useAtelierStore((s) => s.language);
  const activePresetId = useAtelierStore((s) => s.activePresetId);
  const userPresets = useAtelierStore((s) => s.userPresets);
  const lastUserPresetId = useAtelierStore((s) => s.lastUserPresetId);
  const saveUserPreset = useAtelierStore((s) => s.saveUserPreset);
  const updateUserPreset = useAtelierStore((s) => s.updateUserPreset);
  const renameUserPreset = useAtelierStore((s) => s.renameUserPreset);
  const deleteUserPreset = useAtelierStore((s) => s.deleteUserPreset);

  const t = TRANSLATIONS[language].myPresets;
  const [mode, setMode] = useState<Mode>('idle');
  const [name, setName] = useState('');

  // The own preset the buttons act on. After the user edits a measurement the
  // state is 'custom', but the preset it came from stays available.
  const targetId = isUserPresetId(activePresetId)
    ? activePresetId
    : activePresetId === 'custom'
      ? lastUserPresetId
      : null;
  const active = targetId
    ? userPresets.find((p) => p.id === targetId)
    : undefined;
  const isModified = Boolean(active) && activePresetId === 'custom';

  // Leave rename / delete mode when the target preset changes or disappears.
  const activeId = active?.id;
  useEffect(() => {
    setMode((m) => (m === 'rename' || m === 'confirmDelete' ? 'idle' : m));
  }, [activeId]);

  const cancel = () => {
    setMode('idle');
    setName('');
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (mode === 'save') saveUserPreset(trimmed);
    if (mode === 'rename' && active) renameUserPreset(active.id, trimmed);
    cancel();
  };

  if (mode === 'save' || (mode === 'rename' && active)) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          id="user-preset-name-input"
          type="text"
          autoFocus
          maxLength={40}
          value={name}
          placeholder={t.namePlaceholder}
          aria-label={t.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') cancel();
          }}
          className="liquid-glass-pill rounded-xl px-2.5 py-1.5 text-xs outline-none bg-transparent w-32"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          title={t.ok}
          aria-label={t.ok}
          className={`${BTN} disabled:opacity-40`}
        >
          {t.ok}
        </button>
        <button
          type="button"
          onClick={cancel}
          title={t.cancel}
          aria-label={t.cancel}
          className={BTN}
        >
          {t.cancel}
        </button>
      </div>
    );
  }

  if (mode === 'confirmDelete' && active) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{t.confirmDelete}</span>
        <button
          type="button"
          onClick={() => {
            deleteUserPreset(active.id);
            setMode('idle');
          }}
          title={t.confirmYes}
          aria-label={t.confirmYes}
          className={BTN}
        >
          {t.confirmYes}
        </button>
        <button
          type="button"
          onClick={cancel}
          title={t.cancel}
          aria-label={t.cancel}
          className={BTN}
        >
          {t.cancel}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        id="save-user-preset-btn"
        type="button"
        onClick={() => {
          setName('');
          setMode('save');
        }}
        title={t.save}
        aria-label={t.save}
        className={BTN}
      >
        {t.save}
      </button>
      {active && isModified && (
        <span
          id="user-preset-modified-label"
          className="text-[11px] opacity-75 max-w-[160px] truncate"
          title={`${t.modified} ${active.name}`}
        >
          {t.modified} {active.name}
        </span>
      )}
      {active && (
        <>
          <button
            id="update-user-preset-btn"
            type="button"
            onClick={() => updateUserPreset(active.id)}
            title={t.update}
            aria-label={t.update}
            className={BTN}
          >
            {t.update}
          </button>
          <button
            id="rename-user-preset-btn"
            type="button"
            onClick={() => {
              setName(active.name);
              setMode('rename');
            }}
            title={t.rename}
            aria-label={t.rename}
            className={BTN}
          >
            {t.rename}
          </button>
          <button
            id="delete-user-preset-btn"
            type="button"
            onClick={() => setMode('confirmDelete')}
            title={t.remove}
            aria-label={t.remove}
            className={BTN}
          >
            {t.remove}
          </button>
        </>
      )}
    </div>
  );
};
