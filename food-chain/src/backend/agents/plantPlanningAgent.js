/**
 * Plant Planning Agent
 *
 * Recommends species that are specifically suited to the user's location,
 * climate, and constraints. Uses regional plant knowledge for grounding.
 * Falls back to rule-based logic if LLM is unavailable.
 */

import { SPECIES_BY_ID, SPECIES } from '../../data/species.js';
import { generateResponse, parseLLMResponse } from '../services/llmService.js';
import { formatContextForPrompt } from '../core/contextExtractor.js';

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a specialized ecosystem planning AI with deep knowledge of regional horticulture and ecology.

You MUST:
- Tailor every recommendation to the user's specific location, climate, and constraints
- Recommend plants that are genuinely suited to the stated region — not generic defaults
- Explain WHY each plant works for this specific location (climate fit, ecological role, local wildlife benefit)
- Provide at least 3 DIFFERENT suggestions that vary in type (e.g., tree, shrub, groundcover, pollinator plant)
- If the user mentions a specific region, prioritize plants native or well-adapted to that region
- Consider companion planting relationships and ecological function

You MUST NOT:
- Give textbook generic answers that would apply to any garden anywhere
- Repeat the same common plants (milkweed, oak) unless they are genuinely the best fit for this specific location
- Hallucinate species suitability — if unsure, say so
- Recommend invasive species for the user's region

Anti-repetition rule: If your first instinct is to suggest milkweed, oak, or lavender, reconsider — only include them if they are specifically appropriate for the user's stated region and conditions.

If location is missing: ask one targeted follow-up question before recommending.

Return ONLY valid JSON, no markdown, no text outside the JSON:
{
  "summary": "one sentence tailored to the user's specific location and question",
  "reasoning": "2-3 sentences explaining the ecological and regional rationale",
  "recommendations": [
    "Species common name (Latin name) — specific reason tied to user's location/conditions",
    "Species common name (Latin name) — specific reason tied to user's location/conditions",
    "Species common name (Latin name) — specific reason tied to user's location/conditions"
  ],
  "next_actions": ["specific action 1", "specific action 2"],
  "follow_up_question": null
}`;

/**
 * @param {import('../schemas/index.js').AgentInput} input
 * @returns {Promise<import('../schemas/index.js').AgentOutput>}
 */
export async function runPlantPlanningAgent(input) {
  try {
    const { message, profile, ragContext, memory, extractedContext } = input;

    // Rule-based candidates for context and fallback
    const ruleData = computeRuleBasedRecommendations(message, profile, memory);

    // Build grounded prompt
    const userPrompt = buildUserPrompt(message, profile, ruleData, ragContext, memory, extractedContext);

    console.log(`\n[PlantPlanningAgent] ── Prompt ──────────────────────`);
    console.log(userPrompt);
    console.log(`[PlantPlanningAgent] ─────────────────────────────────\n`);

    const raw = await generateResponse({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.5,
    });

    console.log(`[PlantPlanningAgent] ── Raw LLM response ────────────`);
    console.log(raw);
    console.log(`[PlantPlanningAgent] ─────────────────────────────────\n`);

    const parsed = parseLLMResponse(raw);

    if (parsed.ok && parsed.data) {
      const d = parsed.data;

      // If LLM wants to ask a follow-up, surface it
      if (d.follow_up_question && !d.recommendations?.length) {
        return {
          agentId: 'plant-planning',
          success: true,
          data: {
            recommendations: [],
            companionNotes: null,
            warnings: [],
            llmSummary: d.follow_up_question,
            followUpQuestion: d.follow_up_question,
            nextActions: [],
            pollinatorFocus: false,
            totalCandidatesEvaluated: 0,
          },
          error: null,
        };
      }

      return {
        agentId: 'plant-planning',
        success: true,
        data: {
          recommendations: normalizeRecommendations(d.recommendations, ruleData.recommendations),
          companionNotes: d.reasoning || null,
          warnings: ruleData.warnings,
          llmSummary: d.summary || '',
          nextActions: d.next_actions || [],
          pollinatorFocus: /pollinator|bee|butterfly/i.test(message),
          totalCandidatesEvaluated: ruleData.totalCandidatesEvaluated,
          region: extractedContext?.region || null,
        },
        error: null,
      };
    }

    // Fallback to rule-based
    return {
      agentId: 'plant-planning',
      success: true,
      data: { ...ruleData, llmSummary: parsed.raw || '' },
      error: null,
    };

  } catch (err) {
    console.error(`[PlantPlanningAgent] Error:`, err);
    return { agentId: 'plant-planning', success: false, data: {}, error: err.message };
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildUserPrompt(message, profile, ruleData, ragContext, memory, extractedContext) {
  const placed = (profile.placedSpeciesIds || [])
    .map(id => SPECIES_BY_ID[id]?.name).filter(Boolean);
  const failed = (memory?.failedSpecies || []).map(f => f.speciesName);

  const ecosystemType = extractedContext?.constraints?.ecosystemType ?? 'not specified';
  const goal          = extractedContext?.goal ?? 'not specified';

  console.log(`[PlantPlanningAgent] ecosystemType="${ecosystemType}" goal="${goal}" location="${extractedContext?.location ?? extractedContext?.region ?? 'unknown'}"`);

  const lines = [
    `USER QUESTION: "${message}"`,
    '',
    '── EXTRACTED CONTEXT ──────────────────────────────────',
    formatContextForPrompt(extractedContext || {}),
    `Ecosystem type (extracted): ${ecosystemType}`,
    `User goal (extracted): ${goal}`,
    '',
    '── ECOSYSTEM STATE ────────────────────────────────────',
    `Currently placed species: ${placed.length ? placed.join(', ') : 'none'}`,
    `Previously failed (do NOT recommend): ${failed.length ? failed.join(', ') : 'none'}`,
    `User preferences: ${profile.preferences?.join(', ') || 'none specified'}`,
  ];

  // Inject regional knowledge if available
  const rk = extractedContext?.regionalKnowledge;
  if (rk && extractedContext?.region) {
    lines.push('');
    lines.push(`── REGIONAL PLANT KNOWLEDGE: ${extractedContext.region} ──`);
    lines.push(`Recommended for this region: ${rk.goodPlants.join(', ')}`);
    lines.push(`Avoid in this region: ${rk.avoidPlants.join(', ')}`);
    lines.push(`Regional notes: ${rk.notes}`);
  }

  // Add rule-based candidates as additional context (not as the answer)
  if (ruleData.recommendations.length > 0) {
    lines.push('');
    lines.push('── DATABASE CANDIDATES (use as reference, not as final answer) ──');
    ruleData.recommendations.slice(0, 5).forEach(r => {
      lines.push(`  • ${r.name} (${r.latin}) — ${r.reason}`);
    });
  }

  // RAG knowledge
  if (ragContext && ragContext !== 'No specific knowledge base documents matched this query.') {
    lines.push('');
    lines.push('── KNOWLEDGE BASE ──────────────────────────────────────');
    lines.push(ragContext.slice(0, 800));
  }

  lines.push('');
  lines.push('Provide 3–5 species recommendations specifically suited to the user\'s location and conditions.');
  lines.push('Each recommendation must explain WHY it fits this specific region/climate.');

  return lines.join('\n');
}

// ─── Rule-based fallback ──────────────────────────────────────────────────────

function computeRuleBasedRecommendations(message, profile, memory) {
  const msg = message.toLowerCase();
  const wantsPollinators = /pollinator|bee|butterfly|monarch|nectar/.test(msg);
  const wantsNative      = /native|local|indigenous/.test(msg);
  const wantsLowWater    = /drought|low.water|xeriscape|dry/.test(msg);

  const placedIds  = new Set(profile.placedSpeciesIds || []);
  const placedSpecies = [...placedIds].map(id => SPECIES_BY_ID[id]).filter(Boolean);
  const failedIds  = new Set((memory?.failedSpecies || []).map(f => f.speciesId));

  let candidates = SPECIES.filter(s =>
    !placedIds.has(s.id) &&
    !failedIds.has(s.id) &&
    (s.kind === 'plant' || s.kind === 'invertebrate')
  );

  if (profile.climateZone) {
    const zone = profile.climateZone.toLowerCase();
    const filtered = candidates.filter(s => s.climate.includes(zone));
    if (filtered.length >= 3) candidates = filtered;
  }

  const scored = candidates.map(s => ({
    species: s,
    score: scoreCandidate(s, { wantsPollinators, wantsNative, wantsLowWater, placedSpecies }),
  })).sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 8);
  const recommendations = top.map(({ species: s }) => ({
    id: s.id,
    name: s.name,
    latin: s.latin,
    trophic: s.trophic,
    reason: buildReason(s, { wantsPollinators, wantsNative, placedSpecies }),
    waterUse: classifyWaterUse(s),
    isNative: isNativeSpecies(s),
  }));

  return {
    recommendations,
    companionNotes: null,
    warnings: buildCompatibilityWarnings(placedSpecies, top.map(t => t.species)),
    pollinatorFocus: wantsPollinators,
    totalCandidatesEvaluated: candidates.length,
  };
}

function scoreCandidate(species, { wantsPollinators, wantsNative, wantsLowWater, placedSpecies }) {
  let score = 0;
  if (species.trophic === 'producer')   score += 3;
  if (species.trophic === 'decomposer') score += 1;
  if (wantsPollinators && (species.eatenBy.includes('bee') || species.blurb.toLowerCase().includes('pollinator'))) score += 4;
  if (wantsNative    && isNativeSpecies(species))           score += 3;
  if (wantsLowWater  && classifyWaterUse(species) === 'low') score += 3;
  for (const p of placedSpecies) {
    if (p.eatenBy.includes(species.id) || species.eatenBy.includes(p.id)) score += 2;
  }
  return score;
}

function buildReason(species, { wantsPollinators, wantsNative, placedSpecies }) {
  const r = [];
  if (species.trophic === 'producer')   r.push('forms the energy base of your ecosystem');
  if (species.trophic === 'decomposer') r.push('improves nutrient cycling');
  if (wantsPollinators && species.blurb.toLowerCase().includes('pollinator')) r.push('excellent pollinator support');
  if (wantsPollinators && species.eatenBy.includes('bee')) r.push('attracts bees');
  if (isNativeSpecies(species)) r.push('native species — supports local wildlife');
  for (const p of placedSpecies) {
    if (p.eatenBy.includes(species.id)) r.push(`provides food for your ${p.name}`);
  }
  if (r.length === 0) r.push(species.blurb.split('.')[0]);
  return r.join('; ');
}

function classifyWaterUse(species) {
  const b = species.blurb.toLowerCase();
  if (b.includes('drought') || b.includes('dry') || b.includes('arid') || b.includes('neglect')) return 'low';
  if (b.includes('humidity') || b.includes('moist') || b.includes('water')) return 'high';
  return 'medium';
}

function isNativeSpecies(species) {
  return new Set(['oak','milkweed','clover','caterpillar','bee','spider','earthworm',
    'rabbit','squirrel','deer','robin','hawk','fox','mole','lily','duckweed','tadpole']).has(species.id);
}

function buildCompatibilityWarnings(placed, recommended) {
  return recommended
    .filter(r => (r.trophic === 'secondary' || r.trophic === 'tertiary') &&
      r.eats?.length > 0 && !r.eats.some(prey => placed.map(s => s.id).includes(prey)))
    .map(r => `${r.name} is a predator but its prey isn't in your ecosystem yet.`);
}

function normalizeRecommendations(llmRecs, ruleRecs) {
  // If LLM returned valid string recommendations, use them as-is.
  // Do NOT fall back to rule-based species — those are hardcoded defaults
  // that don't reflect the user's actual question.
  if (Array.isArray(llmRecs) && llmRecs.length > 0) {
    return llmRecs.slice(0, 5).map((rec, i) => {
      if (typeof rec === 'string') {
        // Parse "Common Name (Latin) — reason" format
        const dashIdx = rec.indexOf('—');
        const namePart   = dashIdx > -1 ? rec.slice(0, dashIdx).trim() : rec.trim();
        const reasonPart = dashIdx > -1 ? rec.slice(dashIdx + 1).trim() : '';
        // Extract latin name from parentheses if present
        const latinMatch = namePart.match(/\(([^)]+)\)/);
        const commonName = namePart.replace(/\s*\([^)]+\)/, '').trim();
        return {
          id:      `llm-${i}`,
          name:    commonName || rec,
          latin:   latinMatch ? latinMatch[1] : '',
          trophic: 'producer',
          reason:  reasonPart || '',
          waterUse: 'medium',
          isNative: false,
        };
      }
      // Already an object
      return rec;
    });
  }

  // LLM returned nothing — use rule-based as last resort but log it clearly
  console.warn('[PlantPlanningAgent] LLM returned no recommendations — using rule-based fallback');
  return ruleRecs.slice(0, 5);
}
