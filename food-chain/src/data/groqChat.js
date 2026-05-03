/**
 * sendGroqMessage — sends a chat message to Groq with full ecosystem context.
 */
export async function sendGroqMessage({ message, nodes, speciesRegistry, profile, history = [] }) {
  const apiKey = import.meta.env?.VITE_GROQ_API_KEY;
  if (!apiKey || apiKey === 'paste-your-key-here') {
    throw new Error('No Groq API key configured. Add VITE_GROQ_API_KEY to your .env file.');
  }

  // Build ecosystem context
  const species = (nodes || []).map(n => speciesRegistry?.[n.id]).filter(Boolean);
  const byTrophic = {};
  species.forEach(s => {
    byTrophic[s.trophic] = byTrophic[s.trophic] || [];
    byTrophic[s.trophic].push(s.name || s.latin);
  });
  const ecosystemContext = species.length > 0
    ? `Current ecosystem (${species.length} species${profile?.location ? ` in ${profile.location}` : ''}):\n` +
      Object.entries(byTrophic).map(([t, names]) => `  ${t}: ${names.join(', ')}`).join('\n')
    : 'No species on canvas yet.';

  const systemPrompt = `You are the Ecosystem Coach — a knowledgeable, practical AI advisor for ecosystem builders.
You help users understand food webs, improve biodiversity, and make ecological decisions.
Be concise, specific, and grounded in ecology. Never fabricate species facts.

${ecosystemContext}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages,
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
