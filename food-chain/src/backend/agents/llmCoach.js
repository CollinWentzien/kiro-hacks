/**
 * LLM Coach Agent — EcoDoctor
 *
 * Produces TWO things in one LLM call:
 *   ui_message  — warm, conversational, human-like text shown in the chat bubble
 *   data        — structured JSON used to populate cards, scores, and action lists
 *
 * The UI never sees "summary", "reasoning", or raw agent keys.
 */

import { generateResponse, parseLLMResponse } from '../services/llmService.js';
import { formatContextForPrompt } from '../core/contextExtractor.js';

// ─── EcoDoctor system prompt ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an ecosystem coach using a retrieval-augmented knowledge base. You help people design gardens, terrariums, aquariums, and ponds.

PERSONALITY:
- Warm and encouraging, like a knowledgeable friend
- Curious and engaged — you genuinely care about the user's ecosystem
- Explain the "why" in plain, everyday language — no jargon
- Use 1–2 relevant emojis naturally (not forced)
- Never robotic, never generic, never repeat yourself

RULES FOR ui_message — CRITICAL:
1. ANSWER THE USER'S EXACT QUESTION FIRST — before anything else
2. If the user's message contains "garden", "yard", "terrarium", "aquarium", or "pond" — you already know the ecosystem type. Do NOT ask for it again.
3. Use simple, everyday language. Say "food chain" not "trophic levels". Say "water-wise" not "drought-tolerant cultivar".
4. Keep it to 3–5 sentences — focused, not a wall of text
5. Give at least one practical next step the user can take today
6. Ask at most ONE follow-up question, only if genuinely needed — never ask multiple questions
7. Do NOT use robotic labels like "Summary:", "Reasoning:", "Analysis:", "Key Points:"
8. Do NOT mention "agents", "scores", "orchestrator", or any internal system details
9. Do NOT start with "I" as the first word
10. Do NOT use filler like "Great question!", "Certainly!", or "As an AI..."
11. If location is unknown AND the answer truly depends on it, ask for it in one short sentence at the end

SAFETY QUESTION RULE:
- If the user asks about dangerous, toxic, poisonous, invasive, or unsafe plants:
  • Answer immediately with categories of risk (toxic ornamentals, invasive spreaders, aggressive self-seeders, thorny plants, skin-irritating plants)
  • Give 2–3 specific examples per category if possible
  • Then ask ONE question: "What region are you in, and do you have pets or young children?"
  • Do NOT ask for ecosystem type — if they said "garden" you already know

RULES FOR USING RETRIEVED KNOWLEDGE BASE CONTEXT:
- The "RETRIEVED KNOWLEDGE BASE CONTEXT" section in the prompt is your PRIMARY source. Always read it before answering.
- If the context covers the question, answer from it. Do NOT ignore it in favour of general training knowledge.
- Cite source titles naturally in plain language (e.g. "According to the Native Plants guide...")
- Separate document-based facts from general advice — make it clear which is which
- If no chunks were retrieved (STATUS: NO CHUNKS RETRIEVED):
  • Start with: "I don't have strong knowledge-base context for this yet."
  • Then give cautious general advice only if genuinely useful
- If chunks were retrieved but confidence is low (STATUS: LOW CONFIDENCE):
  • Acknowledge: "The knowledge base has limited relevant information, but here is what I found."
- Do NOT invent plant facts, animal facts, toxicity claims, climate facts, or native-species claims
- Do NOT fabricate scientific names, companion planting rules, or water requirements
- Give practical, step-by-step advice grounded in the retrieved context

RULES FOR data:
- plant_suggestions: ONLY populate if the user asked for plant recommendations. Leave empty for safety/diagnosis/general questions.
- sustainability.score: number 0–100 (null if no ecosystem species)
- sustainability.notes: one plain-English sentence about water/native balance
- biodiversity.score: number 0–100 (null if no ecosystem species)
- biodiversity.notes: one plain-English sentence about food chain balance
- diagnosis.possible_issues: array of strings (cause names only)
- diagnosis.fixes: array of strings (one plain-language fix per cause)
- next_actions: 2–3 specific, actionable steps the user can take today

Return ONLY this JSON — no markdown, no text outside it:
{
  "ui_message": "conversational response here",
  "data": {
    "plant_suggestions": [],
    "sustainability": { "score": null, "notes": "" },
    "biodiversity": { "score": null, "notes": "" },
    "diagnosis": { "possible_issues": [], "fixes": [] },
    "next_actions": []
  }
}`;

// ─── Greeting variants (first message only) ───────────────────────────────────

const GREETINGS = [
  "Hi! I'm EcoDoctor 🌿 — I help design and improve ecosystems. What are you working on today?",
  "Hey there! 👋 I'm EcoDoctor — your ecosystem advisor. Tell me about your garden or project!",
  "Hello! 🌱 I'm EcoDoctor. Whether it's a garden, terrarium, or pond — I'm here to help. What's on your mind?",
];

function pickGreeting() {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * @param {Object} params
 * @param {string}  params.userMessage
 * @param {Object}  params.structuredData   - merged agent outputs
 * @param {string}  params.ragContext
 * @param {string}  params.memorySummary
 * @param {Object}  params.extractedContext
 * @param {boolean} params.isFirstMessage   - prepend greeting if true
 * @returns {Promise<string>} JSON string with { ui_message, data }
 */
export async function runLLMCoach({
  userMessage,
  structuredData,
  ragContext,
  memorySummary,
  extractedContext,
  isFirstMessage = false,
}) {
  const userPrompt = buildCoachPrompt({
    userMessage,
    structuredData,
    ragContext,
    memorySummary,
    extractedContext,
    isFirstMessage,
  });

  console.log(`\n[EcoDoctor] ── Prompt ────────────────────────────────`);
  console.log(userPrompt);
  console.log(`[EcoDoctor] ─────────────────────────────────────────\n`);

  const raw = await generateResponse({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.65, // slightly higher for personality
  });

  console.log(`[EcoDoctor] ── Raw LLM response ─────────────────────`);
  console.log(raw);
  console.log(`[EcoDoctor] ─────────────────────────────────────────\n`);

  const parsed = parseLLMResponse(raw);

  // ── Happy path: LLM returned valid JSON with ui_message ──────────
  if (parsed.ok && parsed.data?.ui_message) {
    const result = parsed.data;
    if (isFirstMessage && !result.ui_message.toLowerCase().includes('ecodoc')) {
      result.ui_message = `${pickGreeting()}\n\n${result.ui_message}`;
    }
    return JSON.stringify(result);
  }

  // ── LLM returned plain text (no JSON wrapper) — use it directly ──
  const plainText = parsed.raw || raw || '';
  if (plainText.trim().length > 20) {
    const msg = isFirstMessage
      ? `${pickGreeting()}\n\n${plainText.trim()}`
      : plainText.trim();
    console.log(`[EcoDoctor] Plain-text response, wrapping in schema`);
    return JSON.stringify({ ui_message: msg, data: buildEmptyData() });
  }

  // ── LLM returned nothing useful — retry with a minimal direct prompt ──
  // Never fall back to hardcoded template responses.
  console.warn(`[EcoDoctor] Empty/unparseable LLM response — retrying with minimal prompt`);
  const retryPrompt = [
    `USER QUESTION: "${userMessage}"`,
    '',
    ragContext && ragContext !== 'NO_CHUNKS_RETRIEVED'
      ? `CONTEXT:\n${ragContext.slice(0, 600)}`
      : 'CONTEXT: Knowledge base context is limited for this query.',
    '',
    'Answer the user\'s question directly and helpfully in 2–4 sentences.',
    'Return JSON: { "ui_message": "your answer here", "data": { "plant_suggestions": [], "sustainability": { "score": null, "notes": "" }, "biodiversity": { "score": null, "notes": "" }, "diagnosis": { "possible_issues": [], "fixes": [] }, "next_actions": [] } }',
  ].join('\n');

  const retryRaw = await generateResponse({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: retryPrompt,
    temperature: 0.3,
  });

  const retryParsed = parseLLMResponse(retryRaw);
  if (retryParsed.ok && retryParsed.data?.ui_message) {
    return JSON.stringify(retryParsed.data);
  }

  const retryText = retryParsed.raw || retryRaw || '';
  if (retryText.trim().length > 10) {
    return JSON.stringify({ ui_message: retryText.trim(), data: buildEmptyData() });
  }

  // ── Absolute last resort — honest message, no hardcoded content ──
  console.error(`[EcoDoctor] Both LLM attempts returned empty. Returning honest error message.`);
  return JSON.stringify({
    ui_message: `The AI model didn't return a response for "${userMessage.slice(0, 80)}". ` +
      `Please check that Ollama is running (ollama serve) and try again.`,
    data: buildEmptyData(),
  });
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildCoachPrompt({
  userMessage,
  structuredData,
  ragContext,
  memorySummary,
  extractedContext,
  isFirstMessage,
}) {
  const { planning, sustainability, biodiversity, diagnosis, intents = [] } = structuredData;
  const lines = [];

  if (isFirstMessage) {
    lines.push('NOTE: This is the user\'s FIRST message. Start with a warm greeting as EcoDoctor.');
    lines.push('');
  }

  lines.push(`USER SAID: "${userMessage}"`);
  lines.push(`Intent(s): ${intents.join(', ') || 'general question'}`);

  // Explicitly flag what we already know so the LLM doesn't ask for it again
  const ecosystemType = extractedContext?.constraints?.ecosystemType;
  const goal          = extractedContext?.goal;
  const isSafety      = intents.includes('safety');

  if (ecosystemType) lines.push(`Ecosystem type (already known from message): ${ecosystemType} — DO NOT ask for this again`);
  if (goal)          lines.push(`User goal (already known from message): ${goal} — DO NOT ask for this again`);
  if (isSafety)      lines.push(`SAFETY QUESTION — answer directly, do not ask for ecosystem type`);
  lines.push('');

  // Location + goal context — most important
  const ctxStr = formatContextForPrompt(extractedContext || {});
  if (ctxStr) {
    lines.push('── USER CONTEXT ──────────────────────────────────────');
    lines.push(ctxStr);
    // Explicitly surface goal and ecosystem type so the LLM can't miss them
    const ecosystemType = extractedContext?.constraints?.ecosystemType;
    const goal          = extractedContext?.goal;
    if (ecosystemType) lines.push(`Ecosystem type: ${ecosystemType}`);
    if (goal)          lines.push(`User goal: ${goal}`);
    lines.push('');
  }

  // Memory
  if (memorySummary && memorySummary !== 'No prior history for this user.') {
    lines.push('── PRIOR HISTORY ─────────────────────────────────────');
    lines.push(memorySummary);
    lines.push('');
  }

  // Planning data
  if (planning?.recommendations?.length > 0) {
    lines.push('── PLANT RECOMMENDATIONS (from analysis) ─────────────');
    planning.recommendations.slice(0, 5).forEach(r => {
      lines.push(`  • ${r.name}${r.latin ? ` (${r.latin})` : ''} — ${r.reason}`);
    });
    if (planning.companionNotes) lines.push(`  Companion note: ${planning.companionNotes}`);
    lines.push('');
  }

  // Sustainability scores
  if (sustainability?.score !== undefined) {
    lines.push('── SUSTAINABILITY ─────────────────────────────────────');
    lines.push(`  Score: ${sustainability.score}/100`);
    if (sustainability.llmSummary) lines.push(`  Analysis: ${sustainability.llmSummary}`);
    if (sustainability.suggestions?.length > 0) {
      lines.push(`  Key improvements: ${sustainability.suggestions.slice(0, 2).join('; ')}`);
    }
    lines.push('');
  }

  // Biodiversity scores
  if (biodiversity?.score !== undefined) {
    lines.push('── BIODIVERSITY ───────────────────────────────────────');
    lines.push(`  Score: ${biodiversity.score}/100`);
    if (biodiversity.llmSummary) lines.push(`  Analysis: ${biodiversity.llmSummary}`);
    if (biodiversity.gaps?.length > 0) {
      lines.push(`  Missing food chain layers: ${biodiversity.gaps.join(', ')}`);
    }
    lines.push('');
  }

  // Diagnosis
  if (diagnosis?.applicable && diagnosis.causes?.length > 0) {
    lines.push('── PLANT DIAGNOSIS ────────────────────────────────────');
    diagnosis.causes.forEach(c => {
      lines.push(`  • ${c.cause} (${c.confidence} confidence): ${c.treatment}`);
    });
    if (diagnosis.spreadRisk) lines.push(`  Spread risk: ${diagnosis.spreadRisk}`);
    lines.push('');
  }

  // RAG knowledge — always injected, with clear instruction on how to use it
  const noChunks = !ragContext || ragContext === 'NO_CHUNKS_RETRIEVED';
  const lowConf  = !noChunks && ragContext.startsWith('NOTE: The knowledge base has limited');

  if (noChunks) {
    lines.push('── RETRIEVED KNOWLEDGE BASE CONTEXT ──────────────────');
    lines.push('STATUS: NO CHUNKS RETRIEVED');
    lines.push('The knowledge base returned no matching documents for this query.');
    lines.push('→ Start your answer with: "I don\'t have strong knowledge-base context for this yet."');
    lines.push('→ Then give cautious general advice only if genuinely useful. Do not invent facts.');
    lines.push('');
  } else if (lowConf) {
    lines.push('── RETRIEVED KNOWLEDGE BASE CONTEXT (LOW CONFIDENCE) ─');
    lines.push('STATUS: LOW CONFIDENCE — all chunks have similarity below 70%');
    lines.push('→ Acknowledge: "The knowledge base has limited relevant information, but here is what I found."');
    lines.push('→ Use the content below cautiously. Clearly separate it from general advice.');
    lines.push('');
    lines.push(ragContext);
    lines.push('');
  } else {
    lines.push('── RETRIEVED KNOWLEDGE BASE CONTEXT (USE THIS FIRST) ─');
    lines.push('STATUS: GOOD MATCH — answer primarily from this context.');
    lines.push('→ Cite source titles naturally, e.g. "According to the Native Plants guide..."');
    lines.push('→ Separate document facts from general advice.');
    lines.push('→ Do NOT ignore this context. Do NOT answer from general knowledge if this covers the question.');
    lines.push('');
    lines.push(ragContext);
    lines.push('');
  }

  lines.push('Now write your EcoDoctor response.');
  lines.push('ui_message: answer the user\'s exact question first, warm and specific (3–5 sentences).');
  lines.push('data: populate plant_suggestions ONLY if user asked for plant recommendations.');

  return lines.join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildEmptyData() {
  return {
    plant_suggestions: [],
    sustainability: { score: null, notes: '' },
    biodiversity:   { score: null, notes: '' },
    diagnosis:      { possible_issues: [], fixes: [] },
    next_actions:   [],
  };
}
