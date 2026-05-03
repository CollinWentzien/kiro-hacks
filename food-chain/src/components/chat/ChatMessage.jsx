/**
 * ChatMessage — renders a single message bubble in the chat history.
 * Supports 'user' and 'assistant' roles.
 * Assistant messages render markdown-style bold and line breaks.
 * Includes an optional TextToSpeechButton for assistant messages.
 */

import TextToSpeechButton from './TextToSpeechButton.jsx';

/**
 * Very lightweight markdown renderer:
 * - **text** → <strong>
 * - *text* → <em>
 * - newlines → <br>
 */
function renderMarkdown(text) {
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch) {
      const before = remaining.slice(0, boldMatch.index);
      if (before) parts.push(<span key={key++}>{renderNewlines(before)}</span>);
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Italic: *text*
    const italicMatch = remaining.match(/\*(.+?)\*/);
    if (italicMatch) {
      const before = remaining.slice(0, italicMatch.index);
      if (before) parts.push(<span key={key++}>{renderNewlines(before)}</span>);
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    parts.push(<span key={key++}>{renderNewlines(remaining)}</span>);
    break;
  }

  return parts;
}

function renderNewlines(text) {
  return text.split('\n').reduce((acc, line, i) => {
    if (i > 0) acc.push(<br key={i} />);
    acc.push(line);
    return acc;
  }, []);
}

export default function ChatMessage({
  role,
  content,
  timestamp,
  messageId,
  // TTS props — only used for assistant messages
  ttsEnabled = false,
  speak,
  isSpeaking,
  speakingId,
  ttsSupported,
}) {
  const isUser = role === 'user';
  const time = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      className={`chat-message ${isUser ? 'chat-message--user' : 'chat-message--assistant'}`}
      role="article"
      aria-label={`${isUser ? 'You' : 'EcoDoctor'} said`}
    >
      {/* Role label for screen readers */}
      <div className="chat-message__role" aria-hidden="true">
        {isUser ? 'You' : 'EcoDoctor'}
      </div>

      <div className="chat-message__bubble">
        {isUser ? (
          <span>{content}</span>
        ) : (
          <span>{renderMarkdown(content)}</span>
        )}
      </div>

      <div className="chat-message__meta">
        {time && (
          <time className="chat-message__time" dateTime={timestamp ? new Date(timestamp).toISOString() : undefined}>
            {time}
          </time>
        )}

        {/* TTS button — assistant only, when TTS is enabled */}
        {!isUser && ttsEnabled && (
          <TextToSpeechButton
            text={content}
            messageId={messageId}
            speak={speak}
            isSpeaking={isSpeaking}
            speakingId={speakingId}
            isSupported={ttsSupported}
          />
        )}
      </div>
    </div>
  );
}
