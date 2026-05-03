/**
 * improveEcosystem — builds a prompt from the current canvas state and
 * calls OpenAI to get a short list of improvement suggestions.
 *
 * @param {object} params
 * @param {object[]} params.nodes        - canvas nodes [{id, x, y}]
 * @param {object}   params.speciesRegistry - id → species object
 * @param {object}   params.healthData   - { score, status, warnings, byTrophic, edges }
 * @param {string}   [params.city]       - city name if set
 * @returns {Promise<{ message: string, recommendations: string[], nextActions: string[] }>}
 */
export async function improveEcosystem({ nodes, speciesRegistry, healthData, city }) {
  const species = nodes.map(n => speciesRegistry[n.id]).filter(Boolean);

  // Build trophic summary
  const byTrophic = {};
  species.forEach(s => {
    byTrophic[s.trophic] = (byTrophic[s.trophic] || []);
    byTrophic[s.trophic].push(s.name || s.latin);
  });

  const trophicLines = Object.entries(byTrophic)
    .map(([level, names]) => `  ${level}: ${names.join(', ')}`)
    .join('\n');

  const warningLines = (healthData?.warnings || [])
    .map(w => `  - [${w.badge}] ${w.text}`)
    .join('\n');

  const prompt = `You are an expert ecologist reviewing a food web ecosystem${city ? ` set in ${city}` : ''}.

Current ecosystem (${species.length} species, health score ${healthData?.score ?? '?'}/100 — ${healthData?.status ?? 'unknown'}):

Species by trophic level:
${trophicLines || '  (none)'}

Food web connections: ${healthData?.edges ?? 0}

Current warnings:
${warningLines || '  (none)'}

Give a concise ecological review. Respond in this exact JSON format:
{
  "score": <integer 0-100 representing overall ecosystem health>,
  "summary": "2-3 sentence overall assessment",
  "add": ["species or group to add, with one-line reason", ...],
  "remove": ["species or group to remove or reduce, with one-line reason", ...],
  "actions": ["specific actionable step", ...]
}

Scoring rules (be strict):
- Start at 100
- Mixing freshwater and saltwater species: -50 (they cannot coexist)
- Mixing incompatible biomes (desert + tropical rainforest, arctic + tropical, etc.): -30
- No producers (plants/algae): -25
- No decomposers: -15
- Missing entire trophic levels: -10 each
- Fewer than 4 species: -20
- Invasive species present: -10 each
- Score should reflect real ecological viability, not just diversity count

Keep each list to 3-5 items max. Be specific and ecological, not generic.`;

  // Try OpenAI if key available
  const apiKey = typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_GROQ_API_KEY
    : null;

  if (!apiKey || apiKey === 'paste-your-key-here') {
    throw new Error('No Groq API key configured. Add VITE_GROQ_API_KEY to your .env file.');
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI error ${res.status}`);
  }

  const data = await res.json();
  const parsed = JSON.parse(data.choices[0].message.content);

  // Groq sometimes returns array items as {name: reason} objects instead of strings
  const flatten = arr => (arr || []).map(item =>
    typeof item === 'string' ? item : Object.entries(item).map(([k, v]) => `${k} — ${v}`).join(', ')
  );

  return {
    score: typeof parsed.score === 'number' ? parsed.score : null,
    message: parsed.summary || '',
    recommendations: flatten(parsed.add),
    nextActions: flatten(parsed.actions),
    removals: flatten(parsed.remove),
  };
}


