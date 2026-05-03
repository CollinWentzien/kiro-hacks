/**
 * CoachPage — EcoDoctor chat interface.
 * Route: /coach
 *
 * Rendering contract:
 *   msg.content  → shown in the chat bubble (ui_message — conversational text only)
 *   msg.response → used to populate ResponseCard (structured data — never raw JSON)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { sendChatMessage } from '../services/api/chatApi.js';
import { useTextToSpeech } from '../hooks/useTextToSpeech.js';
import { useAccessibilitySettings } from '../hooks/useAccessibilitySettings.js';
import AccessibilityToolbar from '../components/chat/AccessibilityToolbar.jsx';
import TextToSpeechButton from '../components/chat/TextToSpeechButton.jsx';
import ecosysLogo from '../assets/ecosys-logo.svg';

// ─── Frontend-safe config (VITE_* vars only — never process.env) ─────────────
const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL    = import.meta.env.VITE_OLLAMA_MODEL    ?? 'qwen2.5:3b';
const LLM_PROVIDER    = import.meta.env.VITE_LLM_PROVIDER    ?? 'ollama';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strip any raw JSON blobs that might have leaked into a display string.
 * Returns clean text safe to show in the UI.
 */
function sanitizeDisplayText(text) {
  if (!text || typeof text !== 'string') return '';
  // Remove JSON code fences
  let clean = text.replace(/```json[\s\S]*?```/gi, '').replace(/```[\s\S]*?```/g, '');
  // Remove bare JSON objects/arrays that start at the beginning of a line
  clean = clean.replace(/^\s*\{[\s\S]*?\}\s*$/m, '').replace(/^\s*\[[\s\S]*?\]\s*$/m, '');
  // Remove internal keys that should never appear in UI
  clean = clean.replace(/"(summary|reasoning|reasoning_summary|ui_message|plant_suggestions)":\s*"[^"]*"/g, '');
  return clean.trim();
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function Md({ text }) {
  if (!text) return null;
  const clean = sanitizeDisplayText(text);
  return (
    <>
      {clean.split('\n').map((line, li) => (
        <span key={li}>
          {li > 0 && <br />}
          {renderInline(line)}
        </span>
      ))}
    </>
  );
}

function renderInline(text) {
  const parts = [];
  let rest = text;
  let k = 0;
  while (rest.length) {
    const bold = rest.match(/\*\*(.+?)\*\*/);
    const em   = rest.match(/\*(.+?)\*/);
    const first = [bold, em].filter(Boolean).sort((a, b) => a.index - b.index)[0];
    if (!first) { parts.push(<span key={k++}>{rest}</span>); break; }
    if (first.index > 0) parts.push(<span key={k++}>{rest.slice(0, first.index)}</span>);
    if (first === bold)  parts.push(<strong key={k++}>{bold[1]}</strong>);
    else                 parts.push(<em key={k++}>{em[1]}</em>);
    rest = rest.slice(first.index + first[0].length);
  }
  return parts;
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, score }) {
  const color = score >= 70 ? 'var(--sage)' : score >= 40 ? 'var(--mustard)' : 'var(--rust)';
  return (
    <div className="cp-score-row">
      <span className="cp-score-label">{label}</span>
      <div className="cp-score-track">
        <div className="cp-score-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="cp-score-num">{score}</span>
    </div>
  );
}

// ─── Structured response card ─────────────────────────────────────────────────
// Renders ONLY structured data — never raw text, never JSON keys.

function ResponseCard({ data }) {
  if (!data) return null;

  const {
    recommendations = [],   // from orchestrator (formatted strings)
    sustainability,
    biodiversity,
    diagnosis,
    nextActions = [],
    agentsUsed = [],
  } = data;

  const hasContent =
    recommendations.length > 0 ||
    (sustainability?.score != null) ||
    (biodiversity?.score != null) ||
    (diagnosis?.causes?.length > 0) ||
    nextActions.length > 0;

  if (!hasContent) return null;

  return (
    <div className="cp-response-card">

      {/* Species recommendations — only shown when backend returns dynamic LLM suggestions */}
      {recommendations.length > 0 && (
        <div className="cp-card-section">
          <div className="cp-card-label">🌿 Plant Suggestions</div>
          <ol className="cp-card-list">
            {recommendations.map((r, i) => (
              <li key={i}><Md text={r} /></li>
            ))}
          </ol>
        </div>
      )}

      {/* Ecosystem scores */}
      {(sustainability?.score != null || biodiversity?.score != null) && (
        <div className="cp-card-section">
          <div className="cp-card-label">📊 Ecosystem Health</div>

          {sustainability?.score != null && (
            <ScoreBar label="Sustainability" score={sustainability.score} />
          )}
          {biodiversity?.score != null && (
            <ScoreBar label="Biodiversity" score={biodiversity.score} />
          )}

          {/* Plain-language notes — never show raw JSON */}
          {sustainability?.notes && !sustainability.notes.startsWith('{') && (
            <div className="cp-card-note">{sustainability.notes}</div>
          )}
          {biodiversity?.notes && !biodiversity.notes.startsWith('{') && (
            <div className="cp-card-note">{biodiversity.notes}</div>
          )}

          {/* Sustainability improvement tips */}
          {sustainability?.suggestions?.length > 0 && (
            <ul className="cp-card-list cp-card-list--plain">
              {sustainability.suggestions.slice(0, 3).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}

          {/* Missing trophic levels */}
          {biodiversity?.gaps?.length > 0 && (
            <div className="cp-card-gaps">
              <span className="cp-card-sublabel">Missing from food chain: </span>
              {biodiversity.gaps.map(g => (
                <span key={g} className="cp-gap-tag">{g}</span>
              ))}
            </div>
          )}

          {/* Trophic breakdown grid */}
          {biodiversity?.trophicBreakdown && Object.keys(biodiversity.trophicBreakdown).length > 0 && (
            <div className="cp-trophic-grid">
              {Object.entries(biodiversity.trophicBreakdown).map(([lvl, d]) => (
                <div key={lvl} className={`cp-trophic-cell ${d.count > 0 ? 'present' : 'absent'}`}>
                  <div className="cp-trophic-lvl">{lvl}</div>
                  <div className="cp-trophic-n">{d.count}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Diagnosis */}
      {diagnosis?.causes?.length > 0 && (
        <div className="cp-card-section">
          <div className="cp-card-label">🔍 Diagnosis</div>
          {diagnosis.causes.map((c, i) => (
            <div key={i} className="cp-diagnosis-item">
              <div className="cp-diagnosis-head">
                <strong>{c.cause}</strong>
                <span className={`cp-confidence cp-confidence--${c.confidence}`}>
                  {c.confidence}
                </span>
              </div>
              {c.description && (
                <div className="cp-diagnosis-desc">{c.description}</div>
              )}
              {c.treatment && (
                <div className="cp-diagnosis-tx">
                  <strong>Fix:</strong> {c.treatment}
                </div>
              )}
            </div>
          ))}
          {diagnosis.spreadRisk && (
            <div className="cp-spread-warn">⚠️ {diagnosis.spreadRisk}</div>
          )}
          {diagnosis.clarifyingQuestion && (
            <div className="cp-clarify">💬 {diagnosis.clarifyingQuestion}</div>
          )}
        </div>
      )}

      {/* Next actions */}
      {nextActions.length > 0 && (
        <div className="cp-card-section">
          <div className="cp-card-label">✅ Next Steps</div>
          <ol className="cp-card-list cp-card-list--actions">
            {nextActions.map((a, i) => <li key={i}>{a}</li>)}
          </ol>
        </div>
      )}

      {/* Agent footer removed — internal implementation detail */}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Message({ msg, messageId, ttsEnabled, speak, isSpeaking, speakingId, ttsSupported }) {
  const isUser = msg.role === 'user';
  const time = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`cp-msg cp-msg--${isUser ? 'user' : 'assistant'}`}
      role="article"
      aria-label={`${isUser ? 'You' : 'EcoDoctor'} said`}
    >
      <div className="cp-msg__role" aria-hidden="true">
        {isUser ? 'You' : 'EcoDoctor'}
      </div>
      <div className="cp-msg__bubble">
        {/* Only render sanitized ui_message — never raw JSON */}
        <Md text={msg.content} />
      </div>
      <div className="cp-msg__meta">
        <time className="cp-msg__time">{time}</time>
        {!isUser && ttsEnabled && (
          <TextToSpeechButton
            text={msg.content}
            messageId={messageId}
            speak={speak}
            isSpeaking={isSpeaking}
            speakingId={speakingId}
            isSupported={ttsSupported}
          />
        )}
      </div>
      {/* Structured card below the bubble — only for assistant messages */}
      {!isUser && msg.response && <ResponseCard data={msg.response} />}
    </div>
  );
}

// ─── Suggestion chips ─────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'What plants work well in my area?',
  "How healthy is my ecosystem?",
  'My plant leaves are turning yellow',
  'How do I attract more pollinators?',
  "What's missing from my food chain?",
  'Diagnose my wilting plant',
];

// ─── Welcome message ──────────────────────────────────────────────────────────

const WELCOME = {
  role: 'assistant',
  content: `Hi! I'm EcoDoctor 🌿 — your ecosystem advisor.

I can help you with:
- **Plant selection** tailored to your location and conditions
- **Ecosystem health** — sustainability and biodiversity scores
- **Plant diagnosis** — figure out what's wrong from symptoms
- **Food chain gaps** — what's missing and how to fix it

Tell me where you are and what you're building, and I'll give you specific advice!`,
  timestamp: Date.now(),
  response: null,
};

// ─── Info sidebar ─────────────────────────────────────────────────────────────

function InfoPanel({ lastResponse, llmStatus }) {
  return (
    <aside className="cp-info">

      {/* LLM status */}
      <div className="cp-info__section">
        <div className="cp-info__heading">AI Engine</div>
        <div className={`cp-llm-status cp-llm-status--${llmStatus}`}>
          <span className="cp-llm-status__dot" />
          <span className="cp-llm-status__label">
            {llmStatus === 'ollama'  ? `Ollama · ${OLLAMA_MODEL}` :
             llmStatus === 'mock'    ? 'Mock mode (Ollama offline)' :
                                       'Connecting…'}
          </span>
        </div>
      </div>

      {/* Capabilities */}
      <div className="cp-info__section">
        <div className="cp-info__heading">What EcoDoctor can do</div>
        <ul className="cp-info__list">
          {[
            ['🌿', 'Recommend plants for your region'],
            ['💧', 'Score sustainability & water use'],
            ['🦋', 'Find biodiversity gaps'],
            ['🔍', 'Diagnose plant problems'],
            ['🧠', 'Remember your ecosystem history'],
          ].map(([icon, text]) => (
            <li key={text}><span>{icon}</span>{text}</li>
          ))}
        </ul>
      </div>

      {/* Tips */}
      <div className="cp-info__section">
        <div className="cp-info__heading">Tips for best results</div>
        <ul className="cp-info__list cp-info__list--tips">
          <li>Share your city or region for tailored advice</li>
          <li>Describe symptoms in detail for diagnosis</li>
          <li>Mention sunlight, soil, or water constraints</li>
          <li>Tell me what species you already have</li>
        </ul>
      </div>

      {/* Last analysis — internal summary, not shown as raw JSON */}
      {lastResponse?.reasoningSummary && (
        <div className="cp-info__section">
          <div className="cp-info__heading">Last analysis</div>
          <div className="cp-info__reasoning">{lastResponse.reasoningSummary}</div>
        </div>
      )}

      {/* Navigation */}
      <div className="cp-info__section cp-info__section--nav">
        <Link to="/builder" className="cp-info__nav-link">← Ecosystem Builder</Link>
        <Link to="/"        className="cp-info__nav-link">← Home</Link>
      </div>
    </aside>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoachPage() {
  const [messages,     setMessages]     = useState([WELCOME]);
  const [input,        setInput]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  const [llmStatus,    setLlmStatus]    = useState('unknown');

  // Track whether the user has sent their first message this session
  const isFirstMessageRef = useRef(true);

  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  const { speak, stop, isSpeaking, speakingId, isSupported: ttsSupported } = useTextToSpeech();
  const { settings, toggle, update } = useAccessibilitySettings();

  // Probe Ollama on mount
  useEffect(() => {
    fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? setLlmStatus('ollama') : setLlmStatus('mock'))
      .catch(() => setLlmStatus('mock'));
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const send = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    // Stop any ongoing speech
    stop();

    setInput('');

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      response: null,
    }]);
    setLoading(true);

    // Capture and reset first-message flag
    const firstMsg = isFirstMessageRef.current;
    isFirstMessageRef.current = false;

    try {
      // Build history (skip welcome, last 10)
      const history = messages
        .filter(m => m !== WELCOME)
        .slice(-10)
        .map(({ role, content, timestamp }) => ({ role, content, timestamp }));

      console.log(`[COACH] sending message: "${trimmed.slice(0, 100)}" | firstMsg: ${firstMsg}`);

      const result = await sendChatMessage({
        message: trimmed,
        profile: { userId: 'coach-page', placedSpeciesIds: [] },
        history,
        isFirstMessage: firstMsg,
      });

      if (result.success) {
        setLlmStatus(LLM_PROVIDER === 'ollama' ? 'ollama' : 'mock');
        const displayText = sanitizeDisplayText(result.data.message);
        console.log(`[COACH] received response: "${(displayText || '').slice(0, 100)}"`);
        console.log(`[COACH] plant_suggestions: ${result.data?.recommendations?.length ?? 0} | next_actions: ${result.data?.nextActions?.length ?? 0}`);

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: displayText || "I'm here to help! Could you tell me more about your ecosystem?",
          timestamp: Date.now(),
          response: result.data, // full structured data for ResponseCard
        }]);
        setLastResponse(result.data);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Something went wrong: ${result.error || 'unknown error'}. Please try again.`,
          timestamp: Date.now(),
          response: null,
        }]);
      }
    } catch (err) {
      console.error('[CoachPage]', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I ran into an error. Please try again.',
        timestamp: Date.now(),
        response: null,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="cp-page paper-bg">

      {/* Top bar */}
      <header className="cp-topbar">
        <div className="cp-topbar__brand">
          <Link to="/" className="cp-topbar__logo" aria-label="EcoSys home">
            <img src={ecosysLogo} alt="EcoSys" className="topbar-logo" />
          </Link>
          <span className="cp-topbar__sep">—</span>
          <span className="cp-topbar__name">EcoDoctor</span>
        </div>
        <div className="cp-topbar__right">
          <AccessibilityToolbar settings={settings} toggle={toggle} update={update} />
          <nav className="cp-topbar__nav">
            <Link to="/builder" className="icon-btn">Builder</Link>
            <Link to="/"        className="icon-btn">Home</Link>
          </nav>
        </div>
      </header>

      {/* Body */}
      <div className="cp-body">

        {/* Chat column */}
        <main className="cp-chat-col">

          {/* Messages */}
          <div
            className="cp-messages"
            role="log"
            aria-live="polite"
            aria-label="EcoDoctor chat"
          >
            {messages.map((msg, i) => (
              <Message
                key={i}
                msg={msg}
                messageId={i}
                ttsEnabled={settings.ttsEnabled}
                speak={speak}
                isSpeaking={isSpeaking}
                speakingId={speakingId}
                ttsSupported={ttsSupported}
              />
            ))}

            {loading && (
              <div className="cp-thinking" aria-label="EcoDoctor is thinking">
                <div className="cp-thinking__dots"><span /><span /><span /></div>
                <span className="cp-thinking__text">
                  {llmStatus === 'ollama'
                    ? `EcoDoctor is thinking…`
                    : 'Analyzing your ecosystem…'}
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestion chips */}
          <div className="cp-suggestions" role="list" aria-label="Quick suggestions">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                className="cp-suggestion"
                onClick={() => send(s)}
                disabled={loading}
                role="listitem"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div className="cp-input-bar">
            <textarea
              ref={textareaRef}
              className="cp-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask EcoDoctor about your ecosystem…"
              disabled={loading}
              rows={1}
              maxLength={4000}
              aria-label="Message to EcoDoctor"
            />
            <button
              className={`cp-send ${loading ? 'cp-send--loading' : ''}`}
              onClick={() => send()}
              disabled={!input.trim() || loading}
              aria-label={loading ? 'Thinking…' : 'Send'}
            >
              {loading
                ? <span className="cp-spinner" aria-hidden="true" />
                : <span aria-hidden="true">→</span>
              }
            </button>
          </div>
          <div className="cp-input-hint">Enter to send · Shift+Enter for new line</div>
        </main>

        {/* Info sidebar */}
        <InfoPanel lastResponse={lastResponse} llmStatus={llmStatus} />
      </div>
    </div>
  );
}
