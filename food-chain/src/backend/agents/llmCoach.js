/**
 * LLM Coach Agent
 * Priority: Ollama (local) → Groq (cloud) → error
 */

const SYSTEM_PROMPT = `You are the Ecosystem Coach — a knowledgeable, practical AI advisor for ecosystem builders.
Help users plan gardens, evaluate sustainability, improve biodiversity, and diagnose plant problems.
Be concise, specific, and grounded in ecology. Never fabricate species facts.`;

function buildAgentContext({ structuredData, ragContext }) {
  const { planning, sustainability, biodiversity, diagnosis } = structuredData;
  const lines = [
    sustainability ? `Sustainability score: ${sustainability.score}/100. ${(sustainability.suggestions||[]).slice(0,2).join('; ')}` : null,
    biodiversity ? `Biodiversity score: ${biodiversity.score}/100. Missing trophic levels: ${(biodiversity.gaps||[]).join(', ')||'none'}` : null,
    planning?.recommendations?.length ? `Recommended species: ${planning.recommendations.map(r=>`${r.name} — ${r.reason}`).join('; ')}` : null,
    diagnosis?.causes?.length ? `Diagnosis: ${diagnosis.causes.map(c=>`${c.cause}: ${c.treatment}`).join('; ')}` : null,
  ].filter(Boolean);

  return `${SYSTEM_PROMPT}\n\nAgent analysis:\n${lines.join('\n') || 'No species on canvas yet.'}${ragContext ? `\n\nKnowledge base:\n${ragContext}` : ''}`;
}

export async function runLLMCoach({ userMessage, structuredData, ragContext, memorySummary }) {
  const ollamaUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_OLLAMA_BASE_URL : null;
  const ollamaModel = (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_OLLAMA_MODEL : null) ?? 'qwen2.5:3b';
  const groqKey = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GROQ_API_KEY : null;

  const system = buildAgentContext({ structuredData, ragContext });

  if (ollamaUrl) {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [{ role: 'system', content: system }, { role: 'user', content: userMessage }],
        stream: false,
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error('This feature is currently unavailable.');
    const data = await res.json();
    return data.message?.content ?? data.response ?? '';
  }

  if (groqKey && groqKey !== 'paste-your-key-here') {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'system', content: system }, { role: 'user', content: userMessage }],
        max_tokens: 500,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Groq error ${res.status}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
  }

  throw new Error('This feature is currently unavailable. Please run this project on your local machine to try the chatbot.');
}
