/**
 * Biodiversity Agent
 *
 * Evaluates ecosystem health through the lens of biodiversity:
 * - Trophic level representation
 * - Species diversity
 * - Monoculture detection
 * - Predator-prey balance
 * - Biodiversity Score (0–100)
 *
 * Input: AgentInput
 * Output: AgentOutput with biodiversity data
 */

import { SPECIES_BY_ID } from '../../data/species.js';

const SYSTEM_PROMPT = `You are the Biodiversity Agent. You evaluate ecosystem health by analyzing
trophic level representation, species diversity, monoculture risk, and predator-prey balance.
You identify gaps and recommend additions to improve ecological resilience.`;

/**
 * @param {import('../schemas/index.js').AgentInput} input
 * @returns {Promise<import('../schemas/index.js').AgentOutput>}
 */
export async function runBiodiversityAgent(input) {
  try {
    const { profile } = input;
    const placedIds = profile.placedSpeciesIds || [];

    if (placedIds.length === 0) {
      return {
        agentId: 'biodiversity',
        success: true,
        data: {
          score: 0,
          trophicBreakdown: {},
          gaps: [],
          warnings: [],
          recommendations: [],
          monocultureRisk: false,
        },
        error: null,
      };
    }

    const species = placedIds.map(id => SPECIES_BY_ID[id]).filter(Boolean);
    const idSet = new Set(placedIds);

    // Trophic breakdown
    const trophicCounts = {};
    const allLevels = ['producer', 'primary', 'secondary', 'tertiary', 'decomposer'];
    for (const level of allLevels) {
      trophicCounts[level] = species.filter(s => s.trophic === level).length;
    }

    // Missing trophic levels
    const missingLevels = allLevels.filter(l => trophicCounts[l] === 0);
    const presentLevels = allLevels.filter(l => trophicCounts[l] > 0);

    // Monoculture detection: >60% producers from same "family" (we use kind as proxy)
    const producers = species.filter(s => s.trophic === 'producer');
    const monocultureRisk = detectMonoculture(producers);

    // Predator-prey balance warnings
    const predatorWarnings = detectPredatorImbalance(species, idSet);

    // Biodiversity score calculation
    const score = computeBiodiversityScore({
      species,
      presentLevels,
      missingLevels,
      monocultureRisk,
      predatorWarnings,
    });

    // Recommendations for improvement
    const recommendations = buildRecommendations({
      missingLevels,
      monocultureRisk,
      score,
      species,
    });

    // Trophic breakdown with percentages
    const trophicBreakdown = {};
    for (const level of allLevels) {
      trophicBreakdown[level] = {
        count: trophicCounts[level],
        percentage: species.length > 0 ? Math.round((trophicCounts[level] / species.length) * 100) : 0,
      };
    }

    return {
      agentId: 'biodiversity',
      success: true,
      data: {
        score,
        trophicBreakdown,
        presentLevels,
        gaps: missingLevels,
        monocultureRisk,
        monocultureDetails: monocultureRisk ? getMonocultureDetails(producers) : null,
        predatorWarnings,
        recommendations,
        speciesCount: species.length,
      },
      error: null,
    };
  } catch (err) {
    return {
      agentId: 'biodiversity',
      success: false,
      data: {},
      error: err.message,
    };
  }
}

/** Compute biodiversity score */
function computeBiodiversityScore({ species, presentLevels, missingLevels, monocultureRisk, predatorWarnings }) {
  let score = 100;

  // Deduct for missing trophic levels (up to -50)
  score -= missingLevels.length * 10;

  // Deduct for low species count
  if (species.length < 3) score -= 20;
  else if (species.length < 5) score -= 10;

  // Deduct for monoculture risk
  if (monocultureRisk) score -= 15;

  // Deduct for predator-prey imbalances
  score -= predatorWarnings.length * 8;

  // Bonus for having all 5 trophic levels
  if (presentLevels.length === 5) score += 10;

  // Bonus for species diversity (>8 species)
  if (species.length >= 8) score += 5;

  return Math.max(0, Math.min(100, score));
}

/** Detect monoculture: >60% producers from same environment/kind */
function detectMonoculture(producers) {
  if (producers.length < 3) return false;

  // Group by kind
  const kindCounts = {};
  for (const p of producers) {
    kindCounts[p.kind] = (kindCounts[p.kind] || 0) + 1;
  }

  for (const count of Object.values(kindCounts)) {
    if (count / producers.length > 0.6) return true;
  }

  return false;
}

/** Get monoculture details */
function getMonocultureDetails(producers) {
  const kindCounts = {};
  for (const p of producers) {
    kindCounts[p.kind] = (kindCounts[p.kind] || 0) + 1;
  }
  const dominant = Object.entries(kindCounts).sort((a, b) => b[1] - a[1])[0];
  return `${Math.round((dominant[1] / producers.length) * 100)}% of producers are ${dominant[0]} species`;
}

/** Detect predator-prey imbalances */
function detectPredatorImbalance(species, idSet) {
  const warnings = [];

  for (const s of species) {
    if (s.trophic === 'secondary' || s.trophic === 'tertiary') {
      const hasPrey = s.eats.some(prey => idSet.has(prey));
      if (!hasPrey && s.eats.length > 0) {
        warnings.push({
          species: s.name,
          issue: `${s.name} has no prey present (needs: ${s.eats.join(', ')})`,
          severity: 'warning',
        });
      }
    }
  }

  return warnings;
}

/** Build improvement recommendations */
function buildRecommendations({ missingLevels, monocultureRisk, score, species }) {
  const recs = [];

  if (missingLevels.includes('producer')) {
    recs.push('Add plants (producers) — they are the foundation of any ecosystem');
  }
  if (missingLevels.includes('decomposer')) {
    recs.push('Add earthworms, springtails, or isopods to close the nutrient cycle');
  }
  if (missingLevels.includes('primary')) {
    recs.push('Add primary consumers (herbivores) to create a functional food chain');
  }
  if (missingLevels.includes('secondary')) {
    recs.push('Add secondary consumers (insectivores, omnivores) to regulate herbivore populations');
  }

  if (monocultureRisk) {
    recs.push('Diversify your producer species — mix plants from different families to reduce disease risk');
  }

  if (score < 60 && species.length < 5) {
    recs.push('Add more species overall — a minimum of 5–8 species creates a more stable ecosystem');
  }

  return recs.slice(0, 4);
}
