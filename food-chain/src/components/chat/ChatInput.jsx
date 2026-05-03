/**
 * ChatInput — message input bar for the EcoDoctor chat.
 * Supports Enter to send, Shift+Enter for newline.
 * Shows a loading state while the coach is thinking.
 */

import { useState, useRef, useEffect } from 'react';

const PLACEHOLDER_SUGGESTIONS = [
  'What plants should I add to my ecosystem?',
  "Evaluate my ecosystem's sustainability",
  'My plant leaves are turning yellow — help!',
  'How can I attract more pollinators?',
  "What's missing from my food chain?",
];

export default function ChatInput({ onSend, isLoading, disabled, inputRef: externalRef }) {
  const [value, setValue] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const internalRef = useRef(null);
  const textareaRef = externalRef || internalRef;

  // Rotate placeholder suggestions
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % PLACEHOLDER_SUGGESTIONS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value, textareaRef]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSuggestion = (suggestion) => {
    setValue(suggestion);
    textareaRef.current?.focus();
  };

  return (
    <div className="chat-input-wrap">
      {/* Quick suggestion chips */}
      <div className="chat-input__suggestions" role="list" aria-label="Quick suggestions">
        {PLACEHOLDER_SUGGESTIONS.slice(0, 3).map((s, i) => (
          <button
            key={i}
            className="chat-input__suggestion-chip"
            onClick={() => handleSuggestion(s)}
            disabled={isLoading}
            role="listitem"
            aria-label={`Suggestion: ${s}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="chat-input__row">
        <textarea
          ref={textareaRef}
          className="chat-input__textarea"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER_SUGGESTIONS[placeholderIdx]}
          disabled={isLoading || disabled}
          rows={1}
          maxLength={4000}
          aria-label="Message to EcoDoctor"
          aria-describedby="chat-input-hint"
        />
        <button
          className={`chat-input__send ${isLoading ? 'loading' : ''}`}
          onClick={handleSend}
          disabled={!value.trim() || isLoading || disabled}
          aria-label={isLoading ? 'EcoDoctor is thinking…' : 'Send message'}
        >
          {isLoading ? (
            <span className="chat-input__spinner" aria-hidden="true" />
          ) : (
            <span aria-hidden="true">→</span>
          )}
        </button>
      </div>

      <div id="chat-input-hint" className="chat-input__hint">
        Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line
      </div>
    </div>
  );
}
