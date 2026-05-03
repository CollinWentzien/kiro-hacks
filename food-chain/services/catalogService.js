/**
 * CatalogService
 *
 * Global species catalog search backed by iNaturalist taxa API.
 * Supports free-text search, kingdom filter, and compatibility scoring
 * against an existing species list.
 */

const INAT_TAXA_URL = 'https://api.inaturalist.org/v1/taxa';

const PLANT_ICONIC_TAXA = new Set(['Plantae', 'Fungi', 'Chromista']);

/** Map iNaturalist iconic_taxon_name to our category. */
function toCategory(iconicTaxonName) {
  return PLANT_ICONIC_TAXA.has(iconicTaxonName) ? 'plant' : 'animal';
}

/** Normalize a raw iNaturalist taxon result into a catalog species record. */
function normalizeTaxon(taxon) {
  return {
    scientificName: taxon.name,
    commonName: taxon.preferred_common_name ?? null,
    category: toCategory(taxon.iconic_taxon_name),
    photoUrl: taxon.default_photo?.medium_url ?? null,
    observationCount: taxon.observations_count ?? 0,
    inatTaxonId: taxon.id,
    wikipediaUrl: taxon.wikipedia_url ?? null,
    iconicTaxonName: taxon.iconic_taxon_name ?? null,
    taxonomy: null,
    sources: ['iNaturalist'],
  };
}

/**
 * Search the global species catalog.
 */
export async function searchCatalog({ q, category, kingdom, limit = 30, page = 1 }) {
  const params = new URLSearchParams({
    rank: 'species',
    is_active: 'true',
    per_page: String(Math.min(limit, 200)),
    page: String(page),
    order_by: 'observations_count',
    order: 'desc',
  });

  if (q) params.set('q', q);

  if (kingdom) {
    params.set('iconic_taxa', kingdom);
  } else if (category === 'plant') {
    params.set('iconic_taxa', 'Plantae');
  } else if (category === 'animal') {
    params.set('iconic_taxa', 'Animalia,Mammalia,Aves,Reptilia,Amphibia,Actinopterygii,Insecta,Arachnida');
  }

  try {
    const response = await fetch(`${INAT_TAXA_URL}?${params.toString()}`);
    if (!response.ok) return { error: true, message: `iNaturalist returned ${response.status}` };

    const data = await response.json();
    const results = (data.results ?? []).map(normalizeTaxon);

    return {
      results,
      totalResults: data.total_results ?? results.length,
      page,
    };
  } catch (err) {
    return { error: true, message: err.message };
  }
}

// ---------------------------------------------------------------------------
// Compatibility Scoring
// ---------------------------------------------------------------------------

/**
 * Score compatibility of a candidate species against an existing ecosystem.
 *
 * Returns a score 0–100 and a list of human-readable reason strings.
 *
 * Dimensions (max points):
 *   Food web connections     +35   candidate eats/is eaten by ecosystem species
 *   Pollination support      +15   candidate pollinates plants in the ecosystem
 *   Trophic gap filling      +20   candidate fills a missing trophic role
 *   Taxonomic diversity      +10   candidate adds a new family not yet represented
 *   Native status            +10   candidate is native (not non-native)
 *   Interaction richness     +10   candidate has many known ecological connections
 *   Conflict penalty         -15   candidate competes with or parasitizes many existing species
 *
 * @param {object} candidate          - normalized catalog species record
 * @param {Array}  ecosystemSpecies   - full species list from the city/ecosystem
 * @param {object} [interactions]     - GloBI interaction data for the candidate
 * @returns {{ score: number, label: string, reasons: string[] }}
 */
export function scoreCompatibility(candidate, ecosystemSpecies, interactions = null) {
  let score = 0;
  const reasons = [];

  if (!ecosystemSpecies || ecosystemSpecies.length === 0) {
    return { score: 50, label: 'neutral', reasons: ['No ecosystem context — showing default score'] };
  }

  // Build lookup sets from the ecosystem
  const ecoNames = new Set(ecosystemSpecies.map(s => s.scientificName.trim().toLowerCase()));
  const ecoFamilies = new Set(
    ecosystemSpecies
      .map(s => s.taxonomy?.family?.toLowerCase())
      .filter(Boolean)
  );
  const ecoOrders = new Set(
    ecosystemSpecies
      .map(s => s.taxonomy?.order?.toLowerCase())
      .filter(Boolean)
  );

  // Collect all species that are plants in the ecosystem (for pollination check)
  const ecoPlantNames = new Set(
    ecosystemSpecies
      .filter(s => s.category === 'plant')
      .map(s => s.scientificName.trim().toLowerCase())
  );

  // Trophic role counts
  const plantCount = ecosystemSpecies.filter(s => s.category === 'plant').length;
  const animalCount = ecosystemSpecies.filter(s => s.category === 'animal').length;
  const total = ecosystemSpecies.length;

  // Detect missing roles from existing interaction data
  const hasDecomposer = ecosystemSpecies.some(s =>
    s.interactions?.eats?.some(t => /fungi|decompos|bacteria|detritus/i.test(t))
  );
  const hasTopPredator = ecosystemSpecies.some(s =>
    s.interactions?.eatenBy?.length === 0 && s.interactions?.eats?.length > 0 && s.category === 'animal'
  );
  const hasPollinator = ecosystemSpecies.some(s =>
    s.interactions?.pollinates?.length > 0
  );

  // --- Dimension 1: Food web connections (+35) ---
  if (interactions) {
    const eats = (interactions.eats ?? []).map(n => n.trim().toLowerCase());
    const eatenBy = (interactions.eatenBy ?? []).map(n => n.trim().toLowerCase());

    const preyInEco = eats.filter(n => ecoNames.has(n));
    const predatorsInEco = eatenBy.filter(n => ecoNames.has(n));

    if (preyInEco.length > 0 && predatorsInEco.length > 0) {
      // Fully embedded in the food web — has both prey and predators here
      score += 35;
      reasons.push(`Fits into the food web — eats ${preyInEco.length} species here and is eaten by ${predatorsInEco.length}`);
    } else if (preyInEco.length > 0) {
      score += 25;
      reasons.push(`Eats ${preyInEco.length} species already in this ecosystem`);
    } else if (predatorsInEco.length > 0) {
      score += 20;
      reasons.push(`Is preyed upon by ${predatorsInEco.length} species already in this ecosystem`);
    }
  }

  // --- Dimension 2: Pollination support (+15) ---
  if (interactions) {
    const pollinates = (interactions.pollinates ?? []).map(n => n.trim().toLowerCase());
    const pollinatedBy = (interactions.pollinatedBy ?? []).map(n => n.trim().toLowerCase());

    const pollinatesEcoPlant = pollinates.some(n => ecoPlantNames.has(n));
    const pollinatedByEcoSpecies = pollinatedBy.some(n => ecoNames.has(n));

    if (pollinatesEcoPlant) {
      score += 15;
      reasons.push('Pollinates plants already in this ecosystem');
    } else if (!hasPollinator && candidate.iconicTaxonName === 'Insecta') {
      score += 10;
      reasons.push('Ecosystem has no pollinators — insects fill this role');
    } else if (pollinatedByEcoSpecies) {
      score += 8;
      reasons.push('Is pollinated by species already in this ecosystem');
    }
  }

  // --- Dimension 3: Trophic gap filling (+20) ---
  if (total > 0) {
    const plantRatio = plantCount / total;

    if (candidate.category === 'plant' && plantRatio < 0.25) {
      score += 20;
      reasons.push('Ecosystem critically needs more producers (plants)');
    } else if (candidate.category === 'plant' && plantRatio < 0.4) {
      score += 12;
      reasons.push('Ecosystem is light on producers — more plants improve balance');
    } else if (candidate.category === 'animal' && plantRatio > 0.75) {
      score += 20;
      reasons.push('Ecosystem is plant-heavy — needs more consumers');
    } else if (candidate.category === 'animal' && plantRatio > 0.6) {
      score += 12;
      reasons.push('Ecosystem could use more animal consumers');
    }

    // Missing decomposer role
    if (!hasDecomposer && candidate.iconicTaxonName === 'Fungi') {
      score += 15;
      reasons.push('Ecosystem has no decomposers — fungi fill a critical gap');
    }

    // Missing top predator
    if (!hasTopPredator && candidate.category === 'animal' &&
        interactions?.eats?.length > 3 && interactions?.eatenBy?.length === 0) {
      score += 10;
      reasons.push('Ecosystem lacks a top predator — this species could fill that role');
    }
  }

  // --- Dimension 4: Taxonomic diversity (+10) ---
  const candidateFamily = candidate.taxonomy?.family?.toLowerCase();
  const candidateOrder = candidate.taxonomy?.order?.toLowerCase();

  if (candidateFamily && !ecoFamilies.has(candidateFamily)) {
    score += 10;
    reasons.push(`Adds a new family (${candidate.taxonomy.family}) not yet in this ecosystem`);
  } else if (candidateOrder && !ecoOrders.has(candidateOrder)) {
    score += 5;
    reasons.push(`Adds a new order (${candidate.taxonomy.order}) not yet in this ecosystem`);
  }

  // --- Dimension 5: Native status (+10) ---
  if (candidate.nativeStatus === 'native') {
    score += 10;
    reasons.push('Native to this region');
  } else if (candidate.nativeStatus === 'non-native') {
    score -= 5;
    reasons.push('Non-native — may disrupt local ecosystem balance');
  }
  // unknown nativeStatus = no bonus or penalty

  // --- Dimension 6: Interaction richness (+10) ---
  if (interactions) {
    const totalInteractions =
      (interactions.eats?.length ?? 0) +
      (interactions.eatenBy?.length ?? 0) +
      (interactions.pollinates?.length ?? 0) +
      (interactions.pollinatedBy?.length ?? 0);

    if (totalInteractions > 20) {
      score += 10;
      reasons.push('Highly connected species with many known ecological relationships');
    } else if (totalInteractions > 8) {
      score += 5;
      reasons.push('Well-documented ecological relationships');
    }
  }

  // --- Dimension 7: Conflict penalty (-15) ---
  if (interactions) {
    const competes = (interactions.competesWidth ?? []).map(n => n.trim().toLowerCase());
    const parasitizes = (interactions.parasitizes ?? []).map(n => n.trim().toLowerCase());

    const conflictsInEco = [
      ...competes.filter(n => ecoNames.has(n)),
      ...parasitizes.filter(n => ecoNames.has(n)),
    ];

    if (conflictsInEco.length >= 3) {
      score -= 15;
      reasons.push(`Conflicts with ${conflictsInEco.length} species already in this ecosystem`);
    } else if (conflictsInEco.length > 0) {
      score -= 5 * conflictsInEco.length;
      reasons.push(`Competes with or parasitizes ${conflictsInEco.length} species in this ecosystem`);
    }
  }

  // Clamp to 0–100
  score = Math.max(0, Math.min(100, score));

  const label = score >= 70 ? 'highly compatible'
    : score >= 45 ? 'compatible'
    : score >= 20 ? 'low compatibility'
    : 'not recommended';

  return { score, label, reasons };
}
