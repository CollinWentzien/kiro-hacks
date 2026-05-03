/**
 * Plant Planning Agent
 *
 * Recommends plants and species based on user conditions, existing ecosystem,
 * companion planting relationships, and ecological constraints.
 *
 * Input: AgentInput (message, profile, ragContext, memory)
 * Output: AgentOutput with planning data
 */

import { SPECIES_BY_ID, SPECIES } from '../../data/species.js';

const SYSTEM_PROMPT = `You are the Plant Planning Agent. Your role is to recommend compatible,
ecologically appropriate plants and species for the user's ecosystem. You consider:
- Sunlight, climate zone, and soil conditions
- Companion planting relationships
- Invasive species warnings
- Seasonal planting windows
- Compatibility with existing species on the canvas`;

/**
 * @param {import('../schemas/index.js').AgentInput} input
 * @returns {Promise<import('../schemas/index.js').AgentOutput>}
 */
export async function runPlantPlanningAgent(input) {
  try {
    const { message, profile, ragContext, memory } = input;
    const msg = message.toLowerCase();

    // Determine what the user is asking for
    const wantsPollinators = /pollinator|bee|butterfly|monarch|nectar|habitat/.test(msg);
    const wantsNative = /native|local|indigenous/.test(msg);
    const wantsLowWater = /drought|low.water|xeriscape|dry/.test(msg);
    const wantsFoodGarden = /food|vegetable|herb|edible|tomato|garden/.test(msg);

    // Get species already on canvas
    const placedIds = new Set(profile.placedSpeciesIds || []);
    const placedSpecies = [...placedIds].map(id => SPECIES_BY_ID[id]).filter(Boolean);

    // Get failed species from memory to avoid re-recommending
    const failedIds = new Set((memory?.failedSpecies || []).map(f => f.speciesId));

    // Filter candidate species
    let candidates = SPECIES.filter(s => {
      if (placedIds.has(s.id)) return false; // already placed
      if (failedIds.has(s.id)) return false; // previously failed
      if (s.kind !== 'plant' && s.kind !== 'invertebrate') return false; // focus on plants for planning
      return true;
    });

    // Apply climate filter if profile has climate zone
    if (profile.climateZone) {
      const zone = profile.climateZone.toLowerCase();
      const filtered = candidates.filter(s => s.climate.includes(zone));
      if (filtered.length >= 3) candidates = filtered;
    }

    // Apply preference filters
    if (wantsPollinators) {
      const pollinatorFriendly = ['milkweed', 'clover', 'bee'];
      candidates = candidates.filter(s =>
        pollinatorFriendly.includes(s.id) ||
        s.eatenBy.includes('bee') ||
        s.blurb.toLowerCase().includes('pollinator') ||
        s.blurb.toLowerCase().includes('nectar')
      );
    }

    // Score candidates by relevance
    const scored = candidates.map(s => ({
      species: s,
      score: scoreCandidate(s, { wantsPollinators, wantsNative, wantsLowWater, wantsFoodGarden, placedSpecies }),
    }));

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5);

    // Build recommendations
    const recommendations = top.map(({ species: s }) => ({
      id: s.id,
      name: s.name,
      latin: s.latin,
      trophic: s.trophic,
      reason: buildReason(s, { wantsPollinators, wantsNative, placedSpecies }),
      pollinatorSupport: getPollinatorSupport(s),
      waterUse: classifyWaterUse(s),
      isNative: isNativeSpecies(s),
    }));

    // Companion planting notes
    const companionNotes = buildCompanionNotes(placedSpecies, top.map(t => t.species));

    // Compatibility warnings
    const warnings = buildCompatibilityWarnings(placedSpecies, top.map(t => t.species));

    return {
      agentId: 'plant-planning',
      success: true,
      data: {
        recommendations,
        companionNotes,
        warnings,
        pollinatorFocus: wantsPollinators,
        totalCandidatesEvaluated: candidates.length,
      },
      error: null,
    };
  } catch (err) {
    return {
      agentId: 'plant-planning',
      success: false,
      data: {},
      error: err.message,
    };
  }
}

/** Score a candidate species for relevance */
function scoreCandidate(species, { wantsPollinators, wantsNative, wantsLowWater, wantsFoodGarden, placedSpecies }) {
  let score = 0;

  // Prefer producers for planning
  if (species.trophic === 'producer') score += 3;
  if (species.trophic === 'decomposer') score += 1; // useful additions

  // Pollinator preference
  if (wantsPollinators && (species.eatenBy.includes('bee') || species.blurb.toLowerCase().includes('pollinator'))) {
    score += 4;
  }

  // Native preference
  if (wantsNative && isNativeSpecies(species)) score += 3;

  // Low water preference
  if (wantsLowWater && classifyWaterUse(species) === 'low') score += 3;

  // Synergy with placed species
  for (const placed of placedSpecies) {
    if (placed.eatenBy.includes(species.id) || species.eatenBy.includes(placed.id)) {
      score += 2; // ecological relationship
    }
  }

  return score;
}

/** Build a human-readable reason for recommending a species */
function buildReason(species, { wantsPollinators, wantsNative, placedSpecies }) {
  const reasons = [];

  if (species.trophic === 'producer') reasons.push('forms the energy base of your ecosystem');
  if (species.trophic === 'decomposer') reasons.push('improves nutrient cycling');

  if (wantsPollinators && species.blurb.toLowerCase().includes('pollinator')) {
    reasons.push('excellent pollinator support');
  }
  if (wantsPollinators && species.eatenBy.includes('bee')) {
    reasons.push('attracts bees');
  }

  if (isNativeSpecies(species)) reasons.push('native species — supports local wildlife');

  // Check for ecological relationships with placed species
  for (const placed of placedSpecies) {
    if (placed.eatenBy.includes(species.id)) {
      reasons.push(`provides food for your ${placed.name}`);
    }
  }

  if (reasons.length === 0) reasons.push(species.blurb.split('.')[0]);

  return reasons.join('; ');
}

/** Identify pollinator groups a species supports */
function getPollinatorSupport(species) {
  const blurb = species.blurb.toLowerCase();
  const support = [];
  if (blurb.includes('bee') || species.eatenBy.includes('bee')) support.push('bees');
  if (blurb.includes('butterfly') || blurb.includes('monarch')) support.push('butterflies');
  if (blurb.includes('moth')) support.push('moths');
  if (blurb.includes('bird') || blurb.includes('songbird')) support.push('birds');
  return support;
}

/** Classify water use based on species characteristics */
function classifyWaterUse(species) {
  const blurb = species.blurb.toLowerCase();
  if (blurb.includes('drought') || blurb.includes('dry') || blurb.includes('arid') || blurb.includes('neglect')) {
    return 'low';
  }
  if (blurb.includes('humidity') || blurb.includes('moist') || blurb.includes('water')) {
    return 'high';
  }
  return 'medium';
}

/** Heuristic: check if species is likely native to temperate regions */
function isNativeSpecies(species) {
  const nativeIds = ['oak', 'milkweed', 'clover', 'caterpillar', 'bee', 'spider', 'earthworm',
    'rabbit', 'squirrel', 'deer', 'robin', 'hawk', 'fox', 'mole', 'lily', 'duckweed', 'tadpole'];
  return nativeIds.includes(species.id);
}

/** Build companion planting notes */
function buildCompanionNotes(placed, recommended) {
  const notes = [];

  // Check for known companion relationships
  const hasClover = placed.some(s => s.id === 'clover') || recommended.some(s => s.id === 'clover');
  const hasOak = placed.some(s => s.id === 'oak') || recommended.some(s => s.id === 'oak');
  const hasMilkweed = placed.some(s => s.id === 'milkweed') || recommended.some(s => s.id === 'milkweed');

  if (hasClover) notes.push('White Clover fixes nitrogen — great groundcover companion for most plants');
  if (hasOak && hasMilkweed) notes.push('Oak + Milkweed is a powerful native combination supporting dozens of species');
  if (hasMilkweed) notes.push('Milkweed is essential for monarch butterflies — keep it away from pesticides');

  return notes.join('. ') || null;
}

/** Build compatibility warnings */
function buildCompatibilityWarnings(placed, recommended) {
  const warnings = [];

  for (const rec of recommended) {
    for (const p of placed) {
      // Predator without prey warning
      if ((rec.trophic === 'secondary' || rec.trophic === 'tertiary') &&
          rec.eats.length > 0 && !rec.eats.some(prey => placed.map(s => s.id).includes(prey))) {
        warnings.push(`${rec.name} is a predator but its prey (${rec.eats.join(', ')}) isn't in your ecosystem yet.`);
      }
    }
  }

  return warnings;
}
