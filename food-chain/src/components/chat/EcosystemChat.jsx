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

export default function EcosystemChat({ profile, isOpen, onClose, nodes, speciesRegistry }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = useCallback(async (messageText) => {
    if (!messageText.trim() || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', content: messageText, timestamp: Date.now(), response: null }]);
    setIsLoading(true);

    try {
      const history = messages
        .filter(m => m !== WELCOME_MESSAGE)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));

      // Enrich profile with canvas species IDs from speciesRegistry
      const enrichedProfile = {
        ...(profile || { userId: 'anonymous' }),
        placedSpeciesIds: (nodes || []).map(n => n.id),
      };

      const result = await sendChatMessage({ message: messageText, profile: enrichedProfile, history });

      if (result.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: result.data.message,
          timestamp: Date.now(),
          response: result.data,
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `I encountered an issue: ${result.error || 'Unknown error'}. Please try again.`,
          timestamp: Date.now(),
          response: null,
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I had trouble processing that. Please try again.',
        timestamp: Date.now(),
        response: null,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, profile, nodes, isLoading]);

  if (!isOpen) return null;

  return (
    <div className="ecosystem-chat" role="dialog" aria-label="Ecosystem Coach Chat" aria-modal="true">
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
        <button className="ecosystem-chat__close" onClick={onClose} aria-label="Close chat">×</button>
      </div>

      <div className="ecosystem-chat__body" ref={useRef(null)} role="log" aria-live="polite">
        {messages.map((msg, i) => (
          <div key={i} className="ecosystem-chat__message-group">
            <ChatMessage role={msg.role} content={msg.content} timestamp={msg.timestamp} />
            {msg.role === 'assistant' && msg.response && (
              <ResponseCard response={msg.response} />
            )}
          </div>
        ))}
        {isLoading && (
          <div className="ecosystem-chat__thinking" aria-live="polite">
            <div className="ecosystem-chat__thinking-dots"><span /><span /><span /></div>
            <span className="ecosystem-chat__thinking-text">Analyzing your ecosystem...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {profile?.placedSpeciesIds?.length > 0 && (
        <div className="ecosystem-chat__context-bar">
          <span className="ecosystem-chat__context-icon" aria-hidden="true">🔗</span>
          <span>
            Analyzing your ecosystem with{' '}
            <strong>{(nodes || []).length} species</strong>
            {profile.location ? ` in ${profile.location}` : ''}
          </span>
        </div>
      )}

      <ChatInput onSend={handleSend} isLoading={isLoading} disabled={false} />
    </div>
  );
}
