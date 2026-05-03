/**
 * EcosystemChat — the main chat panel component.
 *
 * Manages:
 * - Message history (user + assistant)
 * - Sending messages via the chat API
 * - Displaying ResponseCards for structured assistant responses
 * - Loading and error states
 * - Text-to-speech for assistant messages
 * - Accessibility toolbar (font size, high contrast, reduced motion)
 *
 * Props:
 * - profile: UserProfile (from parent, includes placedSpeciesIds from canvas)
 * - isOpen: boolean
 * - onClose: function
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import ChatMessage from './ChatMessage.jsx';
import ChatInput from './ChatInput.jsx';
import ResponseCard from './ResponseCard.jsx';
import AccessibilityToolbar from './AccessibilityToolbar.jsx';
import { sendChatMessage } from '../../services/api/chatApi.js';
import { useTextToSpeech } from '../../hooks/useTextToSpeech.js';
import { useAccessibilitySettings } from '../../hooks/useAccessibilitySettings.js';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: `Welcome to EcoDoctor! 🌿

I can help you:
- **Plan** your garden or ecosystem with species recommendations
- **Evaluate** sustainability and biodiversity scores
- **Diagnose** plant problems from symptoms
- **Recall** your planting history and past recommendations

What would you like to work on today?`,
  timestamp: Date.now(),
  response: null,
};

export default function EcosystemChat({ profile, isOpen, onClose }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const inputRef = useRef(null);

  const { speak, stop, isSpeaking, speakingId, isSupported: ttsSupported } = useTextToSpeech();
  const { settings, toggle, update } = useAccessibilitySettings();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Stop TTS when chat closes
  useEffect(() => {
    if (!isOpen) stop();
  }, [isOpen, stop]);

  const handleSend = useCallback(async (messageText) => {
    if (!messageText.trim() || isLoading) return;

    // Stop any ongoing speech
    stop();

    const userMessage = {
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
      response: null,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const history = messages
        .filter(m => m !== WELCOME_MESSAGE)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));

      const result = await sendChatMessage({
        message: messageText,
        profile: profile || { userId: 'anonymous', placedSpeciesIds: [] },
        history,
      });

      if (result.success) {
        const assistantMessage = {
          role: 'assistant',
          content: result.data.message,
          timestamp: Date.now(),
          response: result.data,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errText = result.error || 'Something went wrong. Please try again.';
        setError(errText);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Something went wrong — ${errText} You can try rephrasing your question or sending it again.`,
          timestamp: Date.now(),
          response: null,
        }]);
      }
    } catch (err) {
      console.error('[EcosystemChat] Error:', err);
      const errText = 'Connection error. Please check your setup and try again.';
      setError(errText);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I had trouble processing that. Please try again — if the problem continues, check that Ollama is running.',
        timestamp: Date.now(),
        response: null,
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, profile, isLoading, stop]);

  const handleRetry = useCallback(() => {
    // Find the last user message and resend it
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (lastUser) {
      // Remove the error message and retry
      setMessages(prev => prev.filter(m => !m.isError));
      setError(null);
      handleSend(lastUser.content);
    }
  }, [messages, handleSend]);

  if (!isOpen) return null;

  return (
    <div
      className="ecosystem-chat"
      role="dialog"
      aria-label="EcoDoctor Chat"
      aria-modal="true"
    >
      {/* Header */}
      <div className="ecosystem-chat__header">
        <div className="ecosystem-chat__header-left">
          <div className="ecosystem-chat__avatar" aria-hidden="true">🌿</div>
          <div>
            <div className="ecosystem-chat__title">EcoDoctor</div>
            <div className="ecosystem-chat__subtitle" aria-live="polite">
              {isLoading ? 'EcoDoctor is thinking…' : 'AI-powered ecosystem advisor'}
            </div>
          </div>
        </div>
        <div className="ecosystem-chat__header-actions">
          <AccessibilityToolbar settings={settings} toggle={toggle} update={update} />
          <button
            className="ecosystem-chat__close"
            onClick={onClose}
            aria-label="Close chat"
          >
            ×
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="ecosystem-chat__body"
        ref={chatBodyRef}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        aria-atomic="false"
      >
        {messages.map((msg, i) => (
          <div key={i} className="ecosystem-chat__message-group">
            <ChatMessage
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
              messageId={i}
              ttsEnabled={settings.ttsEnabled}
              speak={speak}
              isSpeaking={isSpeaking}
              speakingId={speakingId}
              ttsSupported={ttsSupported}
            />
            {/* Structured response card for assistant messages */}
            {msg.role === 'assistant' && msg.response && (
              <ResponseCard response={msg.response} />
            )}
            {/* Retry button for error messages */}
            {msg.isError && (
              <button
                className="chat-error-retry"
                onClick={handleRetry}
                aria-label="Retry last message"
              >
                ↺ Try again
              </button>
            )}
          </div>
        ))}

        {/* Loading indicator — announced by screen readers */}
        {isLoading && (
          <div
            className="ecosystem-chat__thinking"
            role="status"
            aria-live="polite"
            aria-label="EcoDoctor is thinking"
          >
            <div className="ecosystem-chat__thinking-dots" aria-hidden="true">
              <span /><span /><span />
            </div>
            <span className="ecosystem-chat__thinking-text">EcoDoctor is thinking…</span>
          </div>
        )}

        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {/* Context bar */}
      {profile?.placedSpeciesIds?.length > 0 && (
        <div className="ecosystem-chat__context-bar" aria-label="Current ecosystem context">
          <span className="ecosystem-chat__context-icon" aria-hidden="true">🔗</span>
          <span>
            Analyzing your ecosystem with{' '}
            <strong>{profile.placedSpeciesIds.length} species</strong>
            {profile.location ? ` in ${profile.location}` : ''}
          </span>
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        disabled={false}
        inputRef={inputRef}
      />
    </div>
  );
}
