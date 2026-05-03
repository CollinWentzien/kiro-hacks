/**
 * TextToSpeechButton — speaker button for reading an assistant message aloud.
 *
 * Props:
 * - text:        string  — the plain text to speak (ui_message, not raw JSON)
 * - messageId:   any     — unique id for this message (e.g. array index)
 * - speak:       fn      — from useTextToSpeech
 * - isSpeaking:  boolean — from useTextToSpeech
 * - speakingId:  any     — from useTextToSpeech
 * - isSupported: boolean — from useTextToSpeech
 */

export default function TextToSpeechButton({ text, messageId, speak, isSpeaking, speakingId, isSupported }) {
  if (!isSupported) return null;

  const isThisOne = isSpeaking && speakingId === messageId;

  return (
    <button
      className={`tts-btn ${isThisOne ? 'tts-btn--active' : ''}`}
      onClick={() => speak(text, messageId)}
      aria-label={isThisOne ? 'Stop reading' : 'Read response aloud'}
      title={isThisOne ? 'Stop reading' : 'Read response aloud'}
      type="button"
    >
      <span aria-hidden="true">{isThisOne ? '⏹' : '🔊'}</span>
    </button>
  );
}
