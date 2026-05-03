/**
 * useAccessibilitySettings — persists user accessibility preferences in localStorage.
 *
 * Settings:
 * - ttsEnabled:      boolean  — whether the TTS speaker button is shown
 * - fontSize:        'small' | 'normal' | 'large'
 * - highContrast:    boolean
 * - reducedMotion:   boolean
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'ecodoc_a11y';

const DEFAULTS = {
  ttsEnabled: true,
  fontSize: 'normal',
  highContrast: false,
  reducedMotion: false,
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function useAccessibilitySettings() {
  const [settings, setSettings] = useState(load);

  // Apply CSS classes to <html> whenever settings change
  useEffect(() => {
    const root = document.documentElement;

    // Font size
    root.classList.remove('font-small', 'font-normal', 'font-large');
    root.classList.add(`font-${settings.fontSize}`);

    // High contrast
    root.classList.toggle('high-contrast', settings.highContrast);

    // Reduced motion
    root.classList.toggle('reduced-motion', settings.reducedMotion);

    save(settings);
  }, [settings]);

  const update = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return { settings, update, toggle };
}
