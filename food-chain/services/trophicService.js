/**
 * TrophicService
 *
 * Assigns trophic levels to species based on their interaction data,
 * taxonomy, and category.
 *
 * Trophic levels:
 *   0 — Decomposer  (fungi, bacteria, detritivores)
 *   1 — Producer    (plants, algae)
 *   2 — Primary Consumer    (herbivores — eat plants)
 *   3 — Secondary Consumer  (eat primary consumers, have predators)
 *   4 — Apex Predator       (eat animals, no predators)
 */

// Keywords that indicate a plant/producer when found in prey names
const PLANT_PREY_KEYWORDS = [
  'grass', 'herb', 'plant', 'seed', 'berry', 'fruit', 'leaf', 'flower',
  'root', 'algae', 'seaweed', 'moss', 'lichen', 'pollen', 'nectar',
  'bark', 'wood', 'fungi', 'mushroom', 'nut', 'grain', 'crop',
];

// Plant genera/families commonly appearing in GloBI prey lists
const PLANT_GENERA = new Set([
  'quercus', 'pinus', 'acer', 'rosa', 'carex', 'poaceae', 'asteraceae',
  'fabaceae', 'gramineae', 'betula', 'salix', 'populus', 'prunus',
  'vaccinium', 'rubus', 'solidago', 'helianthus', 'trifolium', 'medicago',
  'plantae', 'angiospermae', 'magnoliopsida', 'liliopsida', 'pinopsida',
]);

/**
 * Check if a prey name refers to a plant/producer.
 */
function isPlantPrey(preyName) {
  const lower = preyName.trim().toLowerCase();
  if (PLANT_PREY_KEYWORDS.some(kw => lower.includes(kw))) return true;
  const firstWord = lower.split(' ')[0];
  if (PLANT_GENERA.has(firstWord)) return true;
  return false;
}

/**
 * Assign a trophic level to a single species.
 *
 * @param {object} species - species record with interactions, category, iconicTaxonName, taxonomy, commonName
 * @returns {{ trophicLevel: number, trophicLabel: string, trophicNote: string }}
 */
export function assignTrophicLevel(species) {
  const iconic = species.iconicTaxonName ?? '';
  const kingdom = species.taxonomy?.kingdom ?? '';
  const category = species.category ?? '';
  const name = (species.commonName ?? species.scientificName ?? '').toLowerCase();
  const eats = species.interactions?.eats ?? [];
  const eatenBy = species.interactions?.eatenBy ?? [];

  // --- Level 0: Decomposer ---
  if (
    iconic === 'Fungi' ||
    kingdom === 'Fungi' ||
    /mushroom|mold|mould|decompos|detritivore|bacteria|yeast|slime mold/i.test(name)
  ) {
    return {
      trophicLevel: 0,
      trophicLabel: 'decomposer',
      trophicNote: 'Breaks down dead organic matter',
    };
  }

  // --- Level 1: Producer ---
  if (category === 'plant' || iconic === 'Plantae' || kingdom === 'Plantae' || kingdom === 'Chromista') {
    return {
      trophicLevel: 1,
      trophicLabel: 'producer',
      trophicNote: 'Produces energy via photosynthesis',
    };
  }

  // From here, species is an animal
  if (category !== 'animal') {
    // Unknown category — default to primary consumer
    return {
      trophicLevel: 2,
      trophicLabel: 'primary consumer',
      trophicNote: 'Trophic level estimated (insufficient data)',
    };
  }

  // --- Determine what this animal eats ---
  const eatsPlants = eats.some(prey => isPlantPrey(prey));
  const eatsAnimals = eats.some(prey => !isPlantPrey(prey) && prey.trim().length > 0);
  const hasNoInteractionData = eats.length === 0;

  // --- Level 4: Apex Predator ---
  // Eats animals AND has no known predators
  if (eatsAnimals && eatenBy.length === 0 && !eatsPlants) {
    return {
      trophicLevel: 4,
      trophicLabel: 'apex predator',
      trophicNote: `Eats ${eats.length} species, no known predators`,
    };
  }

  // --- Level 3: Secondary Consumer ---
  // Eats animals AND has predators itself
  if (eatsAnimals && eatenBy.length > 0) {
    return {
      trophicLevel: 3,
      trophicLabel: 'secondary consumer',
      trophicNote: `Eats animals, preyed upon by ${eatenBy.length} species`,
    };
  }

  // --- Level 4 (omnivore apex): Eats both plants and animals, no predators ---
  if (eatsPlants && eatsAnimals && eatenBy.length === 0) {
    return {
      trophicLevel: 4,
      trophicLabel: 'apex predator',
      trophicNote: 'Omnivore with no known predators',
    };
  }

  // --- Level 3 (omnivore): Eats both plants and animals, has predators ---
  if (eatsPlants && eatsAnimals && eatenBy.length > 0) {
    return {
      trophicLevel: 3,
      trophicLabel: 'secondary consumer',
      trophicNote: 'Omnivore — eats both plants and animals',
    };
  }

  // --- Level 2: Primary Consumer ---
  // Eats only plants, or has no interaction data (default for animals)
  if (eatsPlants || hasNoInteractionData) {
    return {
      trophicLevel: 2,
      trophicLabel: 'primary consumer',
      trophicNote: eatsPlants
        ? `Herbivore — eats ${eats.filter(isPlantPrey).length} plant species`
        : 'Trophic level estimated — no interaction data available',
    };
  }

  // Fallback
  return {
    trophicLevel: 2,
    trophicLabel: 'primary consumer',
    trophicNote: 'Trophic level estimated',
  };
}

/**
 * Assign trophic levels to an entire species list.
 *
 * @param {Array} speciesList
 * @returns {Array} species list with trophicLevel, trophicLabel, trophicNote added
 */
export function assignBulkTrophicLevels(speciesList) {
  return speciesList.map(species => {
    const { trophicLevel, trophicLabel, trophicNote } = assignTrophicLevel(species);
    return { ...species, trophicLevel, trophicLabel, trophicNote };
  });
}
