/**
 * LLM Coach Agent
 *
 * Converts structured agent outputs into a natural-language chatbot response.
 * In mock mode: uses templates. In production: calls OpenAI/Qwen/local LLM.
 *
 * System prompt defines the Coach's persona and response style.
 */

import { config } from '../core/config.js';

const SYSTEM_PROMPT = `You are the Ecosystem Coach — a knowledgeable, warm, and practical AI advisor
for gardeners, terrarium builders, and ecosystem enthusiasts. You help users plan gardens,
evaluate sustainability, improve biodiversity, diagnose plant problems, and build thriving ecosystems.

Your responses are:
- Grounded in ecological and horticultural knowledge
- Practical and actionable
- Honest about uncertainty
- Encouraging without being patronizing
- Concise but complete

You never fabricate species names, care requirements, or treatment protocols.
When uncertain, you say so clearly.`;

/**
 * Calls the LLM (or mock) to generate a natural-language response.
 *
 * @param {Object} params
 * @param {string} params.userMessage
 * @param {Object} params.structuredData  - merged output from all agents
 * @param {string} params.ragContext
 * @param {string} params.memorySummary
 * @returns {Promise<string>} natural-language response
 */
export async function runLLMCoach({ userMessage, structuredData, ragContext, memorySummary }) {
  if (config.llmProvider === 'mock' || !config.llmApiKey) {
    return generateMockResponse({ userMessage, structuredData, memorySummary });
  }

  // Production path — swap provider here
  if (config.llmProvider === 'openai') {
    return callOpenAI({ userMessage, structuredData, ragContext, memorySummary });
  }

  return generateMockResponse({ userMessage, structuredData, memorySummary });
}

/**
 * Mock response generator — produces realistic-looking responses
 * based on the structured data from agents.
 */
function generateMockResponse({ userMessage, structuredData, memorySummary }) {
  const {
    intents = [],
    planning,
    sustainability,
    biodiversity,
    diagnosis,
    memory: memData,
  } = structuredData;

  const parts = [];

  // Opening — context-aware greeting
  if (memorySummary && memorySummary !== 'No prior history for this user.') {
    parts.push(`Based on your ecosystem history, here's my assessment:`);
  } else {
    parts.push(`Here's what I found for your ecosystem:`);
  }

  // Planning section
  if (planning && planning.recommendations?.length > 0) {
    parts.push(`\n**Plant Recommendations:**`);
    planning.recommendations.forEach((r, i) => {
      parts.push(`${i + 1}. **${r.name}** — ${r.reason}`);
    });
    if (planning.companionNotes) {
      parts.push(`\n*Companion planting note:* ${planning.companionNotes}`);
    }
  }

  // Sustainability section
  if (sustainability) {
    const emoji = sustainability.score >= 70 ? '🌿' : sustainability.score >= 40 ? '⚠️' : '🔴';
    parts.push(`\n**Sustainability Score: ${sustainability.score}/100** ${emoji}`);
    if (sustainability.suggestions?.length > 0) {
      parts.push(`To improve: ${sustainability.suggestions.slice(0, 2).join('; ')}.`);
    }
  }

  // Biodiversity section
  if (biodiversity) {
    parts.push(`\n**Biodiversity Score: ${biodiversity.score}/100**`);
    if (biodiversity.gaps?.length > 0) {
      parts.push(`Missing trophic layers: ${biodiversity.gaps.join(', ')}.`);
    }
    if (biodiversity.recommendations?.length > 0) {
      parts.push(`Consider adding: ${biodiversity.recommendations.join(', ')}.`);
    }
  }

  // Diagnosis section
  if (diagnosis && diagnosis.causes?.length > 0) {
    parts.push(`\n**Diagnosis:**`);
    diagnosis.causes.forEach(c => {
      parts.push(`- **${c.cause}** (${c.confidence} confidence): ${c.treatment}`);
    });
    if (diagnosis.spreadRisk) {
      parts.push(`⚠️ *Spread risk:* ${diagnosis.spreadRisk}`);
    }
  }

  // Memory recall
  if (memData?.recalled) {
    parts.push(`\n*From your history:* ${memData.recalled}`);
  }

  // Fallback if no agents produced output
  if (parts.length <= 1) {
    parts.push(generateFallbackResponse(userMessage));
  }

  return parts.join('\n');
}

/** Generates a helpful fallback when no specific agent matched */
function generateFallbackResponse(message) {
  const msg = message.toLowerCase();

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return `Hello! I'm your Ecosystem Coach. I can help you plan gardens, evaluate sustainability, score biodiversity, diagnose plant problems, and build thriving ecosystems. What would you like to work on today?`;
  }

  if (msg.includes('help') || msg.includes('what can you')) {
    return `I can help you with:
- **Plant recommendations** based on your conditions
- **Sustainability evaluation** of your ecosystem
- **Biodiversity scoring** and trophic analysis
- **Plant problem diagnosis** from symptoms
- **Companion planting** guidance
- **Pollinator support** recommendations

Just describe your garden or ask a specific question!`;
  }

  return `I'd be happy to help with your ecosystem. Could you tell me more about:
- What type of ecosystem you're building (garden, terrarium, aquarium, pond)?
- Your location or climate zone?
- What specific challenge or goal you have in mind?

The more context you share, the better I can tailor my recommendations.`;
}

/**
 * OpenAI integration (production path).
 * Uncomment and configure when ready to use a real LLM.
 */
async function callOpenAI({ userMessage, structuredData, ragContext, memorySummary }) {
  // const { OpenAI } = await import('openai');
  // const client = new OpenAI({ apiKey: config.llmApiKey });
  //
  // const systemContext = [
  //   SYSTEM_PROMPT,
  //   `\n\nUser memory:\n${memorySummary}`,
  //   `\n\nKnowledge base context:\n${ragContext}`,
  //   `\n\nAgent analysis:\n${JSON.stringify(structuredData, null, 2)}`,
  // ].join('\n');
  //
  // const response = await client.chat.completions.create({
  //   model: config.llmModel,
  //   messages: [
  //     { role: 'system', content: systemContext },
  //     { role: 'user', content: userMessage },
  //   ],
  //   max_tokens: 1000,
  // });
  //
  // return response.choices[0].message.content;

  throw new Error('OpenAI integration not yet configured. Set config.llmProvider to "mock".');
}
