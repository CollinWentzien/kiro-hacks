/**
 * GapAnalysisService
 *
 * Analyzes an ecosystem's current species list and produces a structured
 * "gap profile" describing what trophic roles, taxonomic groups, and
 * interaction types are missing or underrepresented.
 *
 * The gap profile is used by the catalog search to rank candidates without
 * needing per-candidate GloBI calls — making live search fast.
 */

/**
 * Analyze an ecosystem species list and return a gap profile.
 *
 * @param {Array} species - array of species records (from city file or user-built)
 * @returns {GapProfile}
 */
export function analyzeGaps(species) {
  if (!species || species.length === 0) {
    return emptyProfile();
  }

  const total = species.length;
  const plants = species.filter(s => s.category === 'plant');
  const animals = species.filter(s => s.category === 'animal');
  const plantRatio = plants.length / total;

  // --- Trophic distribution (if trophic levels are present) ---
  const trophicDistribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const s of species) {
    if (typeof s.trophicLevel === 'number') {
      trophicDistribution[s.trophicLevel] = (trophicDistribution[s.trophicLevel] ?? 0) + 1;
    }
  }

  // Use trophic data for gap detection when available
  const hasTrophicData = species.some(s => typeof s.trophicLevel === 'number');
  const hasProducer = hasTrophicData
    ? trophicDistribution[1] > 0
    : plants.length > 0;

  const hasDecomposer = species.some(s =>
    s.trophicLevel === 0 ||
    s.iconicTaxonName === 'Fungi' ||
    s.taxonomy?.kingdom === 'Fungi' ||
    s.interactions?.eats?.some(t => /detritus|decompos|dead/i.test(t))
  );

  const hasPollinator = species.some(s =>
    s.interactions?.pollinates?.length > 0 ||
    ['Insecta', 'Aves'].includes(s.iconicTaxonName)
  );

  const hasTopPredator = hasTrophicData
    ? trophicDistribution[4] > 0
    : species.some(s =>
        s.category === 'animal' &&
        (s.interactions?.eatenBy?.length === 0) &&
        (s.interactions?.eats?.length > 2)
      );

  const hasHerbivore = hasTrophicData
    ? trophicDistribution[2] > 0
    : species.some(s =>
        s.category === 'animal' &&
        s.interactions?.eats?.length > 0 &&
        plants.some(p =>
          s.interactions.eats.some(prey =>
            prey.toLowerCase().includes(p.scientificName.split(' ')[0].toLowerCase())
          )
        )
      );

  // --- Taxonomic coverage ---
  const familiesPresent = new Set(
    species.map(s => s.taxonomy?.family).filter(Boolean)
  );
  const ordersPresent = new Set(
    species.map(s => s.taxonomy?.order).filter(Boolean)
  );
  const iconicGroupsPresent = new Set(
    species.map(s => s.iconicTaxonName).filter(Boolean)
  );

  // --- Interaction network density ---
  const speciesWithInteractions = species.filter(s =>
    (s.interactions?.eats?.length > 0) ||
    (s.interactions?.eatenBy?.length > 0)
  ).length;
  const interactionDensity = total > 0 ? speciesWithInteractions / total : 0;

  // --- All prey/predator names in the ecosystem (for fast candidate matching) ---
  const allPreyNames = new Set();
  const allPredatorNames = new Set();
  const allPollinatedPlants = new Set();

  for (const s of species) {
    const name = s.scientificName.trim().toLowerCase();
    // This species is prey for anything that eats it
    if (s.interactions?.eatenBy?.length > 0) allPreyNames.add(name);
    // This species is a predator
    if (s.interactions?.eats?.length > 0) allPredatorNames.add(name);
    // Plants that need pollinators
    if (s.category === 'plant') allPollinatedPlants.add(name);
  }

  // All scientific names in the ecosystem (for exclusion and interaction matching)
  const allNames = new Set(species.map(s => s.scientificName.trim().toLowerCase()));

  // --- Gap flags ---
  const gaps = [];
  const neededRoles = [];

  if (!hasProducer) {
    gaps.push('missing_producer');
    neededRoles.push('plant');
  }
  if (!hasDecomposer) {
    gaps.push('missing_decomposer');
    neededRoles.push('fungi');
  }
  if (!hasPollinator && plants.length > 0) {
    gaps.push('missing_pollinator');
    neededRoles.push('insect');
  }
  if (!hasTopPredator && animals.length > 3) {
    gaps.push('missing_top_predator');
  }
  if (!hasHerbivore && plants.length > 0) {
    gaps.push('missing_herbivore');
  }
  if (hasTrophicData && trophicDistribution[2] === 0 && trophicDistribution[1] > 0) {
    gaps.push('missing_primary_consumer');
    neededRoles.push('herbivore');
  }
  if (hasTrophicData && trophicDistribution[4] === 0 && total > 5) {
    gaps.push('missing_apex_predator');
  }
  if (plantRatio < 0.25 && total > 5) {
    gaps.push('too_few_plants');
    neededRoles.push('plant');
  }
  if (plantRatio > 0.75 && total > 5) {
    gaps.push('too_few_animals');
    neededRoles.push('animal');
  }
  if (interactionDensity < 0.3 && total > 10) {
    gaps.push('low_interaction_density');
  }

  return {
    total,
    plantCount: plants.length,
    animalCount: animals.length,
    plantRatio: Math.round(plantRatio * 100) / 100,
    gaps,
    neededRoles,
    trophicRoles: {
      hasProducer,
      hasDecomposer,
      hasPollinator,
      hasTopPredator,
      hasHerbivore,
    },
    trophicDistribution,
    taxonomicCoverage: {
      familiesPresent: [...familiesPresent],
      ordersPresent: [...ordersPresent],
      iconicGroupsPresent: [...iconicGroupsPresent],
    },
    interactionDensity: Math.round(interactionDensity * 100) / 100,
    ecosystemNames: [...allNames],
    preyNames: [...allPreyNames],
    predatorNames: [...allPredatorNames],
    pollinatedPlantNames: [...allPollinatedPlants],
  };
}

/**
 * Score a candidate species against a gap profile WITHOUT needing GloBI data.
 * Uses only the candidate's own fields (taxonomy, category, iconicTaxonName,
 * observationCount) and the pre-computed gap profile.
 *
 * This is fast enough for live search — no external API calls needed.
 *
 * @param {object} candidate   - normalized catalog species record
 * @param {object} gapProfile  - output of analyzeGaps()
 * @returns {{ score: number, label: string, reasons: string[] }}
 */
export function scoreAgainstGaps(candidate, gapProfile) {
  let score = 0;
  const reasons = [];

  const {
    gaps,
    neededRoles,
    trophicRoles,
    taxonomicCoverage,
    ecosystemNames,
    plantRatio,
    total,
  } = gapProfile;

  // Skip if already in ecosystem
  if (ecosystemNames.includes(candidate.scientificName.trim().toLowerCase())) {
    return { score: -1, label: 'already present', reasons: ['Already in this ecosystem'] };
  }

  // --- Gap filling (+40 max) ---
  if (gaps.includes('missing_producer') && candidate.category === 'plant') {
    score += 40;
    reasons.push('Fills critical gap: ecosystem has no producers');
  }
  if (gaps.includes('missing_decomposer') && candidate.iconicTaxonName === 'Fungi') {
    score += 35;
    reasons.push('Fills critical gap: ecosystem has no decomposers');
  }
  if (gaps.includes('missing_pollinator') &&
      ['Insecta', 'Aves'].includes(candidate.iconicTaxonName)) {
    score += 30;
    reasons.push('Fills gap: ecosystem needs pollinators');
  }
  if (gaps.includes('missing_herbivore') && candidate.category === 'animal') {
    score += 20;
    reasons.push('Fills gap: ecosystem needs herbivores to consume plants');
  }
  if (gaps.includes('missing_top_predator') && candidate.category === 'animal') {
    score += 15;
    reasons.push('Could fill top predator role');
  }

  // --- Trophic balance (+20 max) ---
  if (gaps.includes('too_few_plants') && candidate.category === 'plant') {
    score += 20;
    reasons.push('Ecosystem is animal-heavy — more plants improve balance');
  }
  if (gaps.includes('too_few_animals') && candidate.category === 'animal') {
    score += 20;
    reasons.push('Ecosystem is plant-heavy — more animals improve balance');
  }

  // --- Taxonomic diversity (+15 max) ---
  const candidateFamily = candidate.taxonomy?.family;
  const candidateOrder = candidate.taxonomy?.order;
  const candidateIconic = candidate.iconicTaxonName;

  if (candidateFamily &&
      !taxonomicCoverage.familiesPresent.includes(candidateFamily)) {
    score += 15;
    reasons.push(`Adds new family: ${candidateFamily}`);
  } else if (candidateOrder &&
             !taxonomicCoverage.ordersPresent.includes(candidateOrder)) {
    score += 8;
    reasons.push(`Adds new order: ${candidateOrder}`);
  } else if (candidateIconic &&
             !taxonomicCoverage.iconicGroupsPresent.includes(candidateIconic)) {
    score += 12;
    reasons.push(`Adds new group: ${candidateIconic}`);
  }

  // --- Observation count (ecological significance) (+10 max) ---
  if (candidate.observationCount > 500000) {
    score += 10;
    reasons.push('Extremely well-documented species');
  } else if (candidate.observationCount > 100000) {
    score += 7;
    reasons.push('Widely observed and ecologically significant');
  } else if (candidate.observationCount > 10000) {
    score += 3;
  }

  // --- Native status (+10 / -10) ---
  if (candidate.nativeStatus === 'native') {
    score += 10;
    reasons.push('Native to this region');
  } else if (candidate.nativeStatus === 'non-native') {
    score -= 10;
    reasons.push('Non-native — may disrupt local balance');
  }

  // Clamp 0–100
  score = Math.max(0, Math.min(100, score));

  const label = score >= 70 ? 'highly compatible'
    : score >= 45 ? 'compatible'
    : score >= 20 ? 'low compatibility'
    : 'not recommended';

  return { score, label, reasons };
}

function emptyProfile() {
  return {
    total: 0,
    plantCount: 0,
    animalCount: 0,
    plantRatio: 0,
    gaps: ['missing_producer', 'missing_decomposer', 'missing_pollinator'],
    neededRoles: ['plant', 'fungi', 'insect'],
    trophicRoles: {
      hasProducer: false,
      hasDecomposer: false,
      hasPollinator: false,
      hasTopPredator: false,
      hasHerbivore: false,
    },
    trophicDistribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    taxonomicCoverage: {
      familiesPresent: [],
      ordersPresent: [],
      iconicGroupsPresent: [],
    },
    interactionDensity: 0,
    ecosystemNames: [],
    preyNames: [],
    predatorNames: [],
    pollinatedPlantNames: [],
  };
}
