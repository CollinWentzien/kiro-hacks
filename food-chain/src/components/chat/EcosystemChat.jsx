/**
 * EcosystemChat — the main chat panel component.
 *
 * Manages:
 * - Message history (user + assistant)
 * - Sending messages via the chat API
 * - Displaying ResponseCards for structured assistant responses
 * - Loading and error states
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
import { sendChatMessage } from '../../services/api/chatApi.js';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: `Welcome to the Ecosystem Coach! 🌿

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

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = useCallback(async (messageText) => {
    if (!messageText.trim() || isLoading) return;

    // Add user message immediately
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
      // Build history for context (last 10 messages, excluding welcome)
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
          response: result.data, // full CoachResponse for ResponseCard
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setError(result.error || 'Something went wrong. Please try again.');
        // Add error message to chat
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `I encountered an issue: ${result.error || 'Unknown error'}. Please try again.`,
          timestamp: Date.now(),
          response: null,
        }]);
      }
    } catch (err) {
      console.error('[EcosystemChat] Error:', err);
      setError('Connection error. Please try again.');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I had trouble processing that. Please try again.',
        timestamp: Date.now(),
        response: null,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, profile, isLoading]);

  if (!isOpen) return null;

  return (
    <div
      className="ecosystem-chat"
      role="dialog"
      aria-label="Ecosystem Coach Chat"
      aria-modal="true"
    >
      {/* Header */}
      <div className="ecosystem-chat__header">
        <div className="ecosystem-chat__header-left">
          <div className="ecosystem-chat__avatar" aria-hidden="true">🌿</div>
          <div>
            <div className="ecosystem-chat__title">Ecosystem Coach</div>
            <div className="ecosystem-chat__subtitle">
              {isLoading ? 'Thinking...' : 'AI-powered ecosystem advisor'}
            </div>
          </div>
        </div>
        <button
          className="ecosystem-chat__close"
          onClick={onClose}
          aria-label="Close chat"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div
        className="ecosystem-chat__body"
        ref={chatBodyRef}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.map((msg, i) => (
          <div key={i} className="ecosystem-chat__message-group">
            <ChatMessage
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
            />
            {/* Show ResponseCard for assistant messages with structured data */}
            {msg.role === 'assistant' && msg.response && (
              <ResponseCard response={msg.response} />
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="ecosystem-chat__thinking" aria-live="polite" aria-label="Coach is thinking">
            <div className="ecosystem-chat__thinking-dots">
              <span /><span /><span />
            </div>
            <span className="ecosystem-chat__thinking-text">Analyzing your ecosystem...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Context bar — shows what the coach knows */}
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
      />
    </div>
  );
}
