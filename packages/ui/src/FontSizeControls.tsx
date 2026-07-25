'use client';

/**
 * @degenfeed/ui — FontSizeControls & useAccessibilitySettings
 *
 * Font size scaling, high contrast mode, dyslexic-friendly font,
 * and keyboard shortcut registration — all persisted to localStorage.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

/* ─── Constants ────────────────────────────────────────────── */

const STORAGE_KEYS = {
  fontSize: 'df:a11y:fontSize',
  highContrast: 'df:a11y:highContrast',
  dyslexicFont: 'df:a11y:dyslexicFont',
};

const FONT_SIZE_SCALE = [0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.75] as const;

const DYSLEXIC_FONT_FAMILY = "'OpenDyslexic', 'Lexie Readable', sans-serif";

/* ─── Hook ─────────────────────────────────────────────────── */

export interface AccessibilitySettings {
  fontSizeScale: number;
  highContrast: boolean;
  dyslexicFont: boolean;
}

export function useAccessibilitySettings() {
  const [fontSizeIndex, setFontSizeIndex] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.fontSize);
      return stored ? Number(stored) : 2; // default: 1.0 (index 2)
    } catch {
      return 2;
    }
  });

  const [highContrast, setHighContrast] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.highContrast) === 'true';
    } catch {
      return false;
    }
  });

  const [dyslexicFont, setDyslexicFont] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.dyslexicFont) === 'true';
    } catch {
      return false;
    }
  });

  const fontSizeScale = FONT_SIZE_SCALE[fontSizeIndex] ?? 1;

  // Apply font size to root
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSizeScale * 16}px`;
    try {
      localStorage.setItem(STORAGE_KEYS.fontSize, String(fontSizeIndex));
    } catch {
      /* ignore */
    }
  }, [fontSizeIndex, fontSizeScale]);

  // Apply high contrast
  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    try {
      localStorage.setItem(STORAGE_KEYS.highContrast, String(highContrast));
    } catch {
      /* ignore */
    }
  }, [highContrast]);

  // Apply dyslexic font
  useEffect(() => {
    const root = document.documentElement;
    if (dyslexicFont) {
      root.style.setProperty('--font-body', DYSLEXIC_FONT_FAMILY);
      root.style.setProperty('--font-heading', DYSLEXIC_FONT_FAMILY);
    } else {
      root.style.removeProperty('--font-body');
      root.style.removeProperty('--font-heading');
    }
    try {
      localStorage.setItem(STORAGE_KEYS.dyslexicFont, String(dyslexicFont));
    } catch {
      /* ignore */
    }
  }, [dyslexicFont]);

  const increaseFont = useCallback(() => {
    setFontSizeIndex((i) => Math.min(i + 1, FONT_SIZE_SCALE.length - 1));
  }, []);

  const decreaseFont = useCallback(() => {
    setFontSizeIndex((i) => Math.max(i - 1, 0));
  }, []);

  const resetFont = useCallback(() => {
    setFontSizeIndex(2); // 1.0
  }, []);

  const toggleHighContrast = useCallback(() => {
    setHighContrast((v) => !v);
  }, []);

  const toggleDyslexicFont = useCallback(() => {
    setDyslexicFont((v) => !v);
  }, []);

  const settings: AccessibilitySettings = useMemo(
    () => ({ fontSizeScale, highContrast, dyslexicFont }),
    [fontSizeScale, highContrast, dyslexicFont],
  );

  return {
    settings,
    fontSizeIndex,
    increaseFont,
    decreaseFont,
    resetFont,
    toggleHighContrast,
    toggleDyslexicFont,
  };
}

/* ─── FontSizeControls Component ───────────────────────────── */

export interface FontSizeControlsProps {
  fontSizeIndex: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onReset: () => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  dyslexicFont: boolean;
  onToggleDyslexicFont: () => void;
}

export function FontSizeControls({
  fontSizeIndex,
  onIncrease,
  onDecrease,
  onReset,
  highContrast,
  onToggleHighContrast,
  dyslexicFont,
  onToggleDyslexicFont,
}: FontSizeControlsProps) {
  return (
    <div className="font-size-controls" role="region" aria-label="Accessibility settings">
      {/* Font Size */}
      <div className="a11y-control-row">
        <label className="a11y-control-label">Font Size</label>
        <div className="a11y-control-buttons">
          <button
            type="button"
            onClick={onDecrease}
            disabled={fontSizeIndex === 0}
            className="a11y-btn"
            aria-label="Decrease font size"
            title="Decrease font size"
          >
            A<sub>-</sub>
          </button>
          <button
            type="button"
            onClick={onReset}
            className="a11y-btn a11y-btn-reset"
            aria-label="Reset font size"
            title="Reset font size"
          >
            A
          </button>
          <button
            type="button"
            onClick={onIncrease}
            disabled={fontSizeIndex === FONT_SIZE_SCALE.length - 1}
            className="a11y-btn"
            aria-label="Increase font size"
            title="Increase font size"
          >
            A<sup>+</sup>
          </button>
        </div>
        <span className="a11y-control-value">
          {Math.round(FONT_SIZE_SCALE[fontSizeIndex]! * 100)}%
        </span>
      </div>

      {/* High Contrast */}
      <div className="a11y-control-row">
        <label className="a11y-control-label">High Contrast</label>
        <button
          type="button"
          role="switch"
          aria-checked={highContrast}
          onClick={onToggleHighContrast}
          className={`a11y-toggle ${highContrast ? 'active' : ''}`}
        >
          <span className="a11y-toggle-knob" />
        </button>
      </div>

      {/* Dyslexic Font */}
      <div className="a11y-control-row">
        <label className="a11y-control-label">Dyslexic-Friendly Font</label>
        <button
          type="button"
          role="switch"
          aria-checked={dyslexicFont}
          onClick={onToggleDyslexicFont}
          className={`a11y-toggle ${dyslexicFont ? 'active' : ''}`}
        >
          <span className="a11y-toggle-knob" />
        </button>
      </div>
    </div>
  );
}
