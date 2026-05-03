/**
 * Sustainability Agent
 *
 * Evaluates the ecological sustainability of the user's ecosystem.
 * Computes a Sustainability Score (0–100) based on:
 * - Native species ratio (40 pts)
 * - Water efficiency (30 pts)
 * - Trophic completeness (20 pts)
 * - Decomposer presence (10 pts)
 *
 * Input: AgentInput
 * Output: AgentOutput with sustainability data
 */

import { SPECIES_BY_ID } from '../../data/species.js';

const SYSTEM_PROMPT = `You are the Sustainability Agent. You evaluate the ecological sustainability
of ecosystems by analyzing native species ratios, water use, trophic completeness, and decomposer presence.
You provide specific, actionable recommendations to improve sustainability scores.`;

// Species classified as native to temperate North America
const NATIVE_SPECIES_IDS = new Set([
  'oak', 'milkweed', 'clover', 'caterpillar', 'bee', 'spider', 'earthworm',
  'rabbit', 'squirrel', 'deer', 'robin', 'hawk', 'fox', 'mole',
  'lily', 'duckweed', 'tadpole', 'heron', 'koi', 'goldfish',
]);

// Water use classification
const WATER_USE = {
  low: new Set(['oak', 'milkweed', 'clover', 'succulent', 'moss']),
  high: new Set(['lily', 'duckweed', 'fern', 'anubias', 'javafern']),
};

/**
 * @param {import('../schemas/index.js').AgentInput} input
 * @returns {Promise<import('../schemas/index.js').AgentOutput>}
 */
export async function runSustainabilityAgent(input) {
  try {
    const { profile } = input;
    const placedIds = profile.placedSpeciesIds || [];

    if (placedIds.length === 0) {
      return {
        agentId: 'sustainability',
        success: true,
        data: {
          score: 0,
          breakdown: {},
          suggestions: ['Add species to your ecosystem to get a sustainability evaluation.'],
          waterSummary: null,
          nativeRatio: 0,
        },
        error: null,
      };
    }

    const species = placedIds.map(id => SPECIES_BY_ID[id]).filter(Boolean);

    // 1. Native species ratio (40 pts max)
    const nativeCount = species.filter(s => NATIVE_SPECIES_IDS.has(s.id)).length;
    const nativeRatio = nativeCount / species.length;
    const nativeScore = Math.round(nativeRatio * 40);

    // 2. Water efficiency (30 pts max)
    const waterClassifications = species.map(s => classifyWater(s));
    const lowCount = waterClassifications.filter(w => w === 'low').length;
    const highCount = waterClassifications.filter(w => w === 'high').length;
    const waterScore = Math.round(((species.length - highCount) / species.length) * 30);

    // 3. Trophic completeness (20 pts max)
    const trophicLevels = new Set(species.map(s => s.trophic));
    const allLevels = ['producer', 'primary', 'secondary', 'tertiary', 'decomposer'];
    const presentLevels = allLevels.filter(l => trophicLevels.has(l));
    const trophicScore = Math.round((presentLevels.length / allLevels.length) * 20);

    // 4. Decomposer presence (10 pts)
    const hasDecomposer = species.some(s => s.trophic === 'decomposer');
    const decomposerScore = hasDecomposer ? 10 : 0;

    const totalScore = nativeScore + waterScore + trophicScore + decomposerScore;

    // Build suggestions
    const suggestions = buildSuggestions({
      nativeRatio,
      nativeCount,
      species,
      waterClassifications,
      presentLevels,
      hasDecomposer,
      totalScore,
    });

    // Water summary
    const waterSummary = {
      low: waterClassifications.filter(w => w === 'low').length,
      medium: waterClassifications.filter(w => w === 'medium').length,
      high: waterClassifications.filter(w => w === 'high').length,
      totalSpecies: species.length,
    };

    return {
      agentId: 'sustainability',
      success: true,
      data: {
        score: totalScore,
        breakdown: {
          nativeScore,
          waterScore,
          trophicScore,
          decomposerScore,
        },
        nativeRatio: Math.round(nativeRatio * 100),
        waterSummary,
        presentTrophicLevels: presentLevels,
        missingTrophicLevels: allLevels.filter(l => !trophicLevels.has(l)),
        suggestions,
        nativeAlternatives: nativeRatio < 0.3 ? getNativeAlternatives(species) : [],
      },
      error: null,
    };
  } catch (err) {
    return {
      agentId: 'sustainability',
      success: false,
      data: {},
      error: err.message,
    };
  }
}

/** Classify water use for a species */
function classifyWater(species) {
  if (WATER_USE.low.has(species.id)) return 'low';
  if (WATER_USE.high.has(species.id)) return 'high';
  // Infer from environment
  if (species.env.includes('freshwater') || species.env.includes('pond') || species.env.includes('saltwater')) {
    return 'high';
  }
  if (species.climate.includes('arid')) return 'low';
  if (species.climate.includes('tropical')) return 'medium';
  return 'medium';
}

/** Build actionable improvement suggestions */
function buildSuggestions({ nativeRatio, nativeCount, species, waterClassifications, presentLevels, hasDecomposer, totalScore }) {
  const suggestions = [];

  if (nativeRatio < 0.3) {
    suggestions.push(`Only ${Math.round(nativeRatio * 100)}% of your species are native. Aim for 70%+ native species to support local wildlife.`);
  } else if (nativeRatio < 0.7) {
    suggestions.push(`You have ${Math.round(nativeRatio * 100)}% native species — good start. Adding more natives will boost your score.`);
  }

  const highWaterCount = waterClassifications.filter(w => w === 'high').length;
  if (highWaterCount > species.length / 2) {
    suggestions.push(`${highWaterCount} of your species are high water use. Consider replacing some with drought-tolerant alternatives.`);
  }

  if (!presentLevels.includes('producer')) {
    suggestions.push('Add producer species (plants) — they form the energy base of any ecosystem.');
  }

  if (!presentLevels.includes('decomposer')) {
    suggestions.push('Add decomposers (earthworms, springtails, isopods) to close the nutrient cycle.');
  }

  if (!hasDecomposer && species.length >= 3) {
    suggestions.push('Earthworms or springtails would significantly improve your ecosystem\'s nutrient cycling.');
  }

  if (totalScore >= 70) {
    suggestions.push('Your ecosystem is highly sustainable. Consider adding more species diversity to further improve resilience.');
  }

  return suggestions.slice(0, 4);
}

/** Suggest native alternatives for non-native species */
function getNativeAlternatives(species) {
  const nonNative = species.filter(s => !NATIVE_SPECIES_IDS.has(s.id));
  const alternatives = [];

  for (const s of nonNative.slice(0, 2)) {
    if (s.env.includes('backyard')) {
      alternatives.push({
        replacing: s.name,
        suggestion: 'White Oak or Common Milkweed',
        reason: 'Native alternatives that support local wildlife',
      });
    }
  }

  return alternatives;
}
