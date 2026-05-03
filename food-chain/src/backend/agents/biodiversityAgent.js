/**
 * Biodiversity Agent
 *
 * Computes a Biodiversity Score (0–100) using rule-based logic,
 * then uses the LLM to generate natural-language notes and recommendations.
 */

import { SPECIES_BY_ID } from '../../data/species.js';
import { generateResponse, parseLLMResponse } from '../services/llmService.js';
import { formatContextForPrompt } from '../core/contextExtractor.js';

const SYSTEM_PROMPT = `You are a specialized ecosystem biodiversity AI.

You MUST:
- Evaluate biodiversity based on the specific species listed
- Recommend additions that are ecologically appropriate for the user's region
- Explain trophic gaps in plain language

You MUST NOT:
- Give generic biodiversity advice
- Recommend species that don't fit the user's climate or ecosystem type

Return ONLY valid JSON:
{
  "summary": "one sentence biodiversity assessment for this specific ecosystem",
  "reasoning": "brief ecological explanation referencing the actual species",
  "recommendations": ["specific addition 1", "specific addition 2"],
  "next_actions": ["action 1", "action 2"]
}`;

/**
 * @param {import('../schemas/index.js').AgentInput} input
 * @returns {Promise<import('../schemas/index.js').AgentOutput>}
 */
export async function runBiodiversityAgent(input) {
  try {
    const { profile, extractedContext } = input;
    const placedIds = profile.placedSpeciesIds || [];

    if (placedIds.length === 0) {
      return {
        agentId: 'biodiversity', success: true,
        data: { score: 0, trophicBreakdown: {}, gaps: [], warnings: [], recommendations: [], monocultureRisk: false },
        error: null,
      };
    }

    const species = placedIds.map(id => SPECIES_BY_ID[id]).filter(Boolean);
    const idSet = new Set(placedIds);

    // ── Rule-based scoring ──
    const allLevels = ['producer','primary','secondary','tertiary','decomposer'];
    const trophicCounts = Object.fromEntries(allLevels.map(l => [l, species.filter(s => s.trophic === l).length]));
    const missingLevels = allLevels.filter(l => trophicCounts[l] === 0);
    const presentLevels = allLevels.filter(l => trophicCounts[l] > 0);

    const producers = species.filter(s => s.trophic === 'producer');
    const monocultureRisk = detectMonoculture(producers);
    const predatorWarnings = detectPredatorImbalance(species, idSet);

    let score = 100;
    score -= missingLevels.length * 10;
    if (species.length < 3) score -= 20;
    else if (species.length < 5) score -= 10;
    if (monocultureRisk) score -= 15;
    score -= predatorWarnings.length * 8;
    if (presentLevels.length === 5) score += 10;
    if (species.length >= 8) score += 5;
    score = Math.max(0, Math.min(100, score));

    const trophicBreakdown = Object.fromEntries(
      allLevels.map(l => [l, {
        count: trophicCounts[l],
        percentage: species.length > 0 ? Math.round((trophicCounts[l] / species.length) * 100) : 0,
      }])
    );

    // ── LLM for natural-language notes ──
    const contextStr = formatContextForPrompt(extractedContext || {});
    const userPrompt = `${contextStr ? `USER CONTEXT:\n${contextStr}\n\n` : ''}Ecosystem species: ${species.map(s => `${s.name} (${s.trophic})`).join(', ')}

Biodiversity analysis:
- Score: ${score}/100
- Present trophic levels: ${presentLevels.join(', ') || 'none'}
- Missing trophic levels: ${missingLevels.join(', ') || 'none'}
- Monoculture risk: ${monocultureRisk ? 'yes' : 'no'}
- Predator-prey warnings: ${predatorWarnings.map(w => w.issue).join('; ') || 'none'}
- Total species: ${species.length}

Provide 2–3 specific recommendations to improve biodiversity.
If you know the user's region, suggest region-appropriate species to fill the gaps.`;

    console.log(`\n[BiodiversityAgent] ── Prompt ───────────────────────`);
    console.log(userPrompt);
    console.log(`[BiodiversityAgent] ─────────────────────────────────\n`);

    const raw = await generateResponse({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.4 });

    console.log(`[BiodiversityAgent] ── Raw LLM response ────────────`);
    console.log(raw);
    console.log(`[BiodiversityAgent] ─────────────────────────────────\n`);
    const parsed = parseLLMResponse(raw);

    const llmRecs = parsed.ok && Array.isArray(parsed.data?.recommendations)
      ? parsed.data.recommendations
      : buildRuleRecommendations({ missingLevels, monocultureRisk, score, species });

    const llmSummary = parsed.ok ? (parsed.data?.summary || '') : (parsed.raw || '');

    return {
      agentId: 'biodiversity', success: true,
      data: {
        score,
        trophicBreakdown,
        presentLevels,
        gaps: missingLevels,
        monocultureRisk,
        predatorWarnings,
        recommendations: llmRecs,
        llmSummary,
        speciesCount: species.length,
      },
      error: null,
    };
  } catch (err) {
    return { agentId: 'biodiversity', success: false, data: {}, error: err.message };
  }
}

function detectMonoculture(producers) {
  if (producers.length < 3) return false;
  const kindCounts = {};
  for (const p of producers) kindCounts[p.kind] = (kindCounts[p.kind] || 0) + 1;
  return Object.values(kindCounts).some(c => c / producers.length > 0.6);
}

function detectPredatorImbalance(species, idSet) {
  return species
    .filter(s => (s.trophic === 'secondary' || s.trophic === 'tertiary') && s.eats?.length > 0)
    .filter(s => !s.eats.some(prey => idSet.has(prey)))
    .map(s => ({ species: s.name, issue: `${s.name} has no prey present (needs: ${s.eats.join(', ')})`, severity: 'warning' }));
}

function buildRuleRecommendations({ missingLevels, monocultureRisk, score, species }) {
  const recs = [];
  if (missingLevels.includes('producer')) recs.push('Add plants (producers) — they are the foundation of any ecosystem');
  if (missingLevels.includes('decomposer')) recs.push('Add earthworms, springtails, or isopods to close the nutrient cycle');
  if (missingLevels.includes('primary')) recs.push('Add primary consumers (herbivores) to create a functional food chain');
  if (missingLevels.includes('secondary')) recs.push('Add secondary consumers to regulate herbivore populations');
  if (monocultureRisk) recs.push('Diversify producer species — mix plants from different families');
  if (score < 60 && species.length < 5) recs.push('Add more species — 5–8 creates a more stable ecosystem');
  return recs.slice(0, 4);
}
