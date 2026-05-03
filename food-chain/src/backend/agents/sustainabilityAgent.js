/**
 * Sustainability Agent
 *
 * Computes a Sustainability Score (0–100) using rule-based logic,
 * then uses the LLM to generate natural-language notes and suggestions.
 */

import { SPECIES_BY_ID } from '../../data/species.js';
import { generateResponse, parseLLMResponse } from '../services/llmService.js';
import { formatContextForPrompt } from '../core/contextExtractor.js';

const SYSTEM_PROMPT = `You are a specialized ecosystem sustainability AI.

You MUST:
- Evaluate sustainability based on the specific species listed and the user's location/climate
- Provide recommendations that are actionable for the user's specific region
- Reference the user's climate when suggesting native alternatives

You MUST NOT:
- Give generic sustainability advice that ignores the specific ecosystem
- Recommend the same plants regardless of location

Return ONLY valid JSON:
{
  "summary": "one sentence assessment specific to this ecosystem",
  "reasoning": "brief explanation referencing the actual species and scores",
  "recommendations": ["specific improvement 1", "specific improvement 2", "specific improvement 3"],
  "next_actions": ["action 1", "action 2"]
}`;

const NATIVE_IDS = new Set(['oak','milkweed','clover','caterpillar','bee','spider','earthworm',
  'rabbit','squirrel','deer','robin','hawk','fox','mole','lily','duckweed','tadpole','heron','koi','goldfish']);
const WATER_LOW  = new Set(['oak','milkweed','clover','succulent','moss']);
const WATER_HIGH = new Set(['lily','duckweed','fern','anubias','javafern']);

/**
 * @param {import('../schemas/index.js').AgentInput} input
 * @returns {Promise<import('../schemas/index.js').AgentOutput>}
 */
export async function runSustainabilityAgent(input) {
  try {
    const { profile, extractedContext } = input;
    const placedIds = profile.placedSpeciesIds || [];

    if (placedIds.length === 0) {
      return {
        agentId: 'sustainability', success: true,
        data: { score: 0, breakdown: {}, suggestions: ['Add species to get a sustainability evaluation.'], waterSummary: null, nativeRatio: 0 },
        error: null,
      };
    }

    const species = placedIds.map(id => SPECIES_BY_ID[id]).filter(Boolean);

    // ── Rule-based scoring ──
    const nativeCount = species.filter(s => NATIVE_IDS.has(s.id)).length;
    const nativeRatio = nativeCount / species.length;
    const nativeScore = Math.round(nativeRatio * 40);

    const waterClasses = species.map(s => classifyWater(s));
    const highCount = waterClasses.filter(w => w === 'high').length;
    const waterScore = Math.round(((species.length - highCount) / species.length) * 30);

    const trophicSet = new Set(species.map(s => s.trophic));
    const allLevels = ['producer','primary','secondary','tertiary','decomposer'];
    const presentLevels = allLevels.filter(l => trophicSet.has(l));
    const trophicScore = Math.round((presentLevels.length / allLevels.length) * 20);

    const hasDecomposer = species.some(s => s.trophic === 'decomposer');
    const decomposerScore = hasDecomposer ? 10 : 0;
    const totalScore = nativeScore + waterScore + trophicScore + decomposerScore;

    const waterSummary = {
      low:    waterClasses.filter(w => w === 'low').length,
      medium: waterClasses.filter(w => w === 'medium').length,
      high:   highCount,
      totalSpecies: species.length,
    };

    // ── LLM for natural-language notes ──
    const contextStr = formatContextForPrompt(extractedContext || {});
    const userPrompt = `${contextStr ? `USER CONTEXT:\n${contextStr}\n\n` : ''}Ecosystem species: ${species.map(s => `${s.name} (${s.trophic})`).join(', ')}

Computed scores:
- Native species: ${Math.round(nativeRatio * 100)}% (${nativeScore}/40 pts)
- Water efficiency: ${waterScore}/30 pts (${highCount} high-water species)
- Trophic completeness: ${presentLevels.length}/5 levels present (${trophicScore}/20 pts)
- Decomposers present: ${hasDecomposer ? 'yes' : 'no'} (${decomposerScore}/10 pts)
- Total sustainability score: ${totalScore}/100

Provide 3 specific, actionable recommendations to improve this ecosystem's sustainability.
If you know the user's region, suggest region-appropriate native alternatives.`;

    console.log(`\n[SustainabilityAgent] ── Prompt ─────────────────────`);
    console.log(userPrompt);
    console.log(`[SustainabilityAgent] ────────────────────────────────\n`);

    const raw = await generateResponse({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.4 });

    console.log(`[SustainabilityAgent] ── Raw LLM response ───────────`);
    console.log(raw);
    console.log(`[SustainabilityAgent] ────────────────────────────────\n`);
    const parsed = parseLLMResponse(raw);

    const llmSuggestions = parsed.ok && Array.isArray(parsed.data?.recommendations)
      ? parsed.data.recommendations
      : buildRuleSuggestions({ nativeRatio, species, waterClasses, presentLevels, hasDecomposer, totalScore });

    const llmSummary = parsed.ok ? (parsed.data?.summary || '') : (parsed.raw || '');

    return {
      agentId: 'sustainability', success: true,
      data: {
        score: totalScore,
        breakdown: { nativeScore, waterScore, trophicScore, decomposerScore },
        nativeRatio: Math.round(nativeRatio * 100),
        waterSummary,
        presentTrophicLevels: presentLevels,
        missingTrophicLevels: allLevels.filter(l => !trophicSet.has(l)),
        suggestions: llmSuggestions,
        llmSummary,
        nativeAlternatives: nativeRatio < 0.3 ? [{ suggestion: 'native plants suited to your region', reason: 'Increasing native species ratio improves sustainability score' }] : [],
      },
      error: null,
    };
  } catch (err) {
    return { agentId: 'sustainability', success: false, data: {}, error: err.message };
  }
}

function classifyWater(species) {
  if (WATER_LOW.has(species.id)) return 'low';
  if (WATER_HIGH.has(species.id)) return 'high';
  if (species.env?.includes('freshwater') || species.env?.includes('pond') || species.env?.includes('saltwater')) return 'high';
  if (species.climate?.includes('arid')) return 'low';
  return 'medium';
}

function buildRuleSuggestions({ nativeRatio, species, waterClasses, presentLevels, hasDecomposer, totalScore }) {
  const s = [];
  if (nativeRatio < 0.3) s.push(`Only ${Math.round(nativeRatio * 100)}% native species — aim for 70%+ to support local wildlife.`);
  else if (nativeRatio < 0.7) s.push(`${Math.round(nativeRatio * 100)}% native species — adding more natives will boost your score.`);
  const highCount = waterClasses.filter(w => w === 'high').length;
  if (highCount > species.length / 2) s.push(`${highCount} high-water species — consider drought-tolerant alternatives.`);
  if (!presentLevels.includes('decomposer')) s.push('Add decomposers (earthworms, springtails) to close the nutrient cycle.');
  if (!presentLevels.includes('producer')) s.push('Add producer species (plants) — they form the energy base.');
  if (totalScore >= 70) s.push('Great sustainability score! Add more species diversity to improve resilience.');
  return s.slice(0, 4);
}
