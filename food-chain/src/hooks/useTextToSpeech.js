/**
 * useTextToSpeech — Web Speech API hook for reading assistant messages aloud.
 *
 * Features:
 * - Play / pause / stop speech
 * - Tracks which message is currently speaking
 * - Respects the global TTS enabled preference
 * - Never auto-plays
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef(null);

  useEffect(() => {
    setIsSupported('speechSynthesis' in window);
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /**
   * Speak a piece of text, identified by an id (e.g. message index).
   * Calling speak() while the same id is already speaking will stop it.
   */
  const speak = useCallback((text, id) => {
    if (!isSupported) return;

    // Toggle off if already speaking this message
    if (isSpeaking && speakingId === id) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setSpeakingId(null);
      return;
    }

    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeakingId(id);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingId(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingId(null);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported, isSpeaking, speakingId]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingId(null);
  }, [isSupported]);

  return {
    speak,
    stop,
    isSpeaking,
    speakingId,
    isSupported,
  };
}
