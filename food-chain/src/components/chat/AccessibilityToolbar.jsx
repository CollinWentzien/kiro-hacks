/**
 * AccessibilityToolbar — floating toolbar for chat accessibility controls.
 *
 * Controls:
 * - TTS toggle (show/hide speaker buttons)
 * - Font size: small / normal / large
 * - High contrast mode
 * - Reduced motion mode
 *
 * Props:
 * - settings: from useAccessibilitySettings
 * - toggle:   fn(key) — from useAccessibilitySettings
 * - update:   fn(key, value) — from useAccessibilitySettings
 */

export default function AccessibilityToolbar({ settings, toggle, update }) {
  return (
    <div
      className="a11y-toolbar"
      role="toolbar"
      aria-label="Accessibility controls"
    >
      <span className="a11y-toolbar__label" aria-hidden="true">A11Y</span>

      {/* TTS toggle */}
      <button
        className={`a11y-btn ${settings.ttsEnabled ? 'a11y-btn--on' : ''}`}
        onClick={() => toggle('ttsEnabled')}
        aria-pressed={settings.ttsEnabled}
        aria-label={settings.ttsEnabled ? 'Disable text-to-speech' : 'Enable text-to-speech'}
        title="Text-to-speech"
        type="button"
      >
        <span aria-hidden="true">🔊</span>
      </button>

      {/* Font size */}
      <div className="a11y-font-group" role="group" aria-label="Font size">
        {['small', 'normal', 'large'].map(size => (
          <button
            key={size}
            className={`a11y-btn a11y-font-btn ${settings.fontSize === size ? 'a11y-btn--on' : ''}`}
            onClick={() => update('fontSize', size)}
            aria-pressed={settings.fontSize === size}
            aria-label={`Font size ${size}`}
            title={`Font size: ${size}`}
            type="button"
          >
            <span aria-hidden="true" style={{ fontSize: size === 'small' ? '10px' : size === 'large' ? '16px' : '13px' }}>A</span>
          </button>
        ))}
      </div>

      {/* High contrast */}
      <button
        className={`a11y-btn ${settings.highContrast ? 'a11y-btn--on' : ''}`}
        onClick={() => toggle('highContrast')}
        aria-pressed={settings.highContrast}
        aria-label={settings.highContrast ? 'Disable high contrast' : 'Enable high contrast'}
        title="High contrast"
        type="button"
      >
        <span aria-hidden="true">◑</span>
      </button>

      {/* Reduced motion */}
      <button
        className={`a11y-btn ${settings.reducedMotion ? 'a11y-btn--on' : ''}`}
        onClick={() => toggle('reducedMotion')}
        aria-pressed={settings.reducedMotion}
        aria-label={settings.reducedMotion ? 'Disable reduced motion' : 'Enable reduced motion'}
        title="Reduced motion"
        type="button"
      >
        <span aria-hidden="true">⏸</span>
      </button>
    </div>
  );
}
