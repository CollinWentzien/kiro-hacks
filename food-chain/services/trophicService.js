/**
 * TrophicService
 *
 * Assigns trophic levels to species based on taxonomy first, then GloBI
 * interaction data as a fallback. Taxonomy takes priority because GloBI
 * coverage is too sparse to be reliable on its own.
 *
 * Trophic levels:
 *   0 — Decomposer
 *   1 — Producer
 *   2 — Primary Consumer (herbivore)
 *   3 — Secondary Consumer (eats animals, has predators)
 *   4 — Apex Predator (eats animals, no predators)
 */

// ─── Taxonomy lookup tables ───────────────────────────────────────────────────

const APEX_ORDERS = new Set(['carnivora', 'crocodilia']);
const APEX_FAMILIES = new Set([
  'accipitridae', 'falconidae', 'strigidae', 'tytonidae', 'cathartidae',
  'felidae', 'canidae', 'ursidae', 'mustelidae',
  'viperidae', 'elapidae', 'colubridae',
  'esocidae', 'istiophoridae',
]);

const HERBIVORE_ORDERS = new Set([
  'rodentia', 'lagomorpha', 'artiodactyla', 'perissodactyla',
  'sirenia', 'proboscidea', 'lepidoptera', 'orthoptera', 'phasmatodea', 'isoptera',
]);
const HERBIVORE_FAMILIES = new Set([
  'cervidae', 'bovidae', 'leporidae', 'sciuridae', 'cricetidae', 'muridae',
  'pieridae', 'nymphalidae', 'papilionidae', 'lycaenidae',
]);

const SECONDARY_ORDERS = new Set([
  'passeriformes', 'piciformes', 'columbiformes', 'galliformes', 'anseriformes',
  'gruiformes', 'charadriiformes', 'ciconiiformes', 'pelecaniformes', 'suliformes',
  'squamata', 'testudines', 'anura', 'caudata',
  'chiroptera', 'insectivora',
  'araneae', 'scorpiones', 'odonata', 'mantodea',
  'coleoptera', 'diptera', 'hymenoptera', 'hemiptera',
]);

/**
 * Returns a trophic result based purely on taxonomy, or null if unknown.
 */
// Name-based fallbacks for species with null taxonomy (common in catalog results)
const DECOMPOSER_NAME = /\bslug|snail|isopod|pill bug|woodlouse|millipede|earthworm|worm\b|fungus gnat|dung beetle|carrion/i;
const HERBIVORE_NAME  = /\bbutterfly|moth\b|caterpillar|aphid|whitefly|leafhopper|thrips|weevil|sawfly/i;
const SECONDARY_NAME  = /\bdragonfly|damselfly|mantis|assassin bug|robber fly|ground beetle|centipede|spider\b|scorpion/i;
const APEX_NAME       = /\beagle|hawk|falcon|owl|osprey|kite\b|harrier|wolf|coyote|mountain lion|cougar|bobcat|lynx|bear|otter|mink|weasel|ferret|rattlesnake|copperhead|cottonmouth|mamba|cobra/i;

function taxonomyOverride(species) {
  const order  = (species.taxonomy?.order  ?? '').toLowerCase();
  const family = (species.taxonomy?.family ?? '').toLowerCase();
  const cls    = (species.taxonomy?.class  ?? '').toLowerCase();

  if (APEX_ORDERS.has(order) || APEX_FAMILIES.has(family))
    return { trophicLevel: 4, trophicLabel: 'apex predator',     trophicNote: 'Apex predator (taxonomy)' };
  if (HERBIVORE_ORDERS.has(order) || HERBIVORE_FAMILIES.has(family))
    return { trophicLevel: 2, trophicLabel: 'primary consumer',  trophicNote: 'Herbivore (taxonomy)' };
  if (SECONDARY_ORDERS.has(order))
    return { trophicLevel: 3, trophicLabel: 'secondary consumer', trophicNote: 'Secondary consumer (taxonomy)' };
  // Class-level fallbacks
  if (cls === 'aves')
    return { trophicLevel: 3, trophicLabel: 'secondary consumer', trophicNote: 'Secondary consumer (taxonomy)' };
  if (cls === 'actinopterygii' || cls === 'chondrichthyes')
    return { trophicLevel: 3, trophicLabel: 'secondary consumer', trophicNote: 'Secondary consumer (taxonomy)' };
  if (cls === 'gastropoda')
    return { trophicLevel: 0, trophicLabel: 'decomposer', trophicNote: 'Decomposer/detritivore (taxonomy)' };

  // Name-based fallback for null taxonomy
  const name = (species.commonName ?? species.scientificName ?? '');
  if (DECOMPOSER_NAME.test(name))
    return { trophicLevel: 0, trophicLabel: 'decomposer',        trophicNote: 'Decomposer/detritivore (name match)' };
  if (APEX_NAME.test(name))
    return { trophicLevel: 4, trophicLabel: 'apex predator',     trophicNote: 'Apex predator (name match)' };
  if (SECONDARY_NAME.test(name))
    return { trophicLevel: 3, trophicLabel: 'secondary consumer', trophicNote: 'Secondary consumer (name match)' };
  if (HERBIVORE_NAME.test(name))
    return { trophicLevel: 2, trophicLabel: 'primary consumer',  trophicNote: 'Herbivore (name match)' };

  return null;
}

// ─── GloBI helpers ────────────────────────────────────────────────────────────

const PLANT_PREY_KEYWORDS = [
  'grass', 'herb', 'plant', 'seed', 'berry', 'fruit', 'leaf', 'flower',
  'root', 'algae', 'seaweed', 'moss', 'lichen', 'pollen', 'nectar',
  'bark', 'wood', 'fungi', 'mushroom', 'nut', 'grain', 'crop',
];
const PLANT_GENERA = new Set([
  'quercus', 'pinus', 'acer', 'rosa', 'carex', 'poaceae', 'asteraceae',
  'fabaceae', 'gramineae', 'betula', 'salix', 'populus', 'prunus',
  'vaccinium', 'rubus', 'solidago', 'helianthus', 'trifolium', 'medicago',
  'plantae', 'angiospermae', 'magnoliopsida', 'liliopsida', 'pinopsida',
]);

function isPlantPrey(preyName) {
  const lower = preyName.trim().toLowerCase();
  if (PLANT_PREY_KEYWORDS.some(kw => lower.includes(kw))) return true;
  return PLANT_GENERA.has(lower.split(' ')[0]);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Assign a trophic level to a single species.
 */
export function assignTrophicLevel(species) {
  const iconic    = species.iconicTaxonName ?? '';
  const kingdom   = species.taxonomy?.kingdom ?? '';
  const category  = species.category ?? '';
  const name      = (species.commonName ?? species.scientificName ?? '').toLowerCase();
  const eats      = species.interactions?.eats    ?? [];
  const eatenBy   = species.interactions?.eatenBy ?? [];

  // --- Level 0: Decomposer ---
  if (
    iconic === 'Fungi' ||
    kingdom === 'Fungi' ||
    /mushroom|mold|mould|decompos|detritivore|bacteria|yeast|slime mold/i.test(name)
  ) {
    return { trophicLevel: 0, trophicLabel: 'decomposer', trophicNote: 'Breaks down dead organic matter' };
  }

  // --- Level 1: Producer ---
  if (category === 'plant' || iconic === 'Plantae' || kingdom === 'Plantae' || kingdom === 'Chromista') {
    return { trophicLevel: 1, trophicLabel: 'producer', trophicNote: 'Produces energy via photosynthesis' };
  }

  // --- Taxonomy override (more reliable than GloBI for most species) ---
  if (category === 'animal') {
    const override = taxonomyOverride(species);
    if (override) return override;
  }

  // --- GloBI interaction fallback ---
  if (category !== 'animal') {
    return { trophicLevel: 2, trophicLabel: 'primary consumer', trophicNote: 'Trophic level estimated (insufficient data)' };
  }

  const eatsPlants  = eats.some(prey => isPlantPrey(prey));
  const eatsAnimals = eats.some(prey => !isPlantPrey(prey) && prey.trim().length > 0);
  const noData      = eats.length === 0;

  // Cap at secondary if taxonomy is unknown — GloBI misclassifies invertebrates as apex
  const hasNullTaxonomy = !species.taxonomy?.order && !species.taxonomy?.family;

  if (eatsAnimals && eatenBy.length === 0 && !hasNullTaxonomy)
    return { trophicLevel: 4, trophicLabel: 'apex predator',     trophicNote: `Eats ${eats.length} species, no known predators` };
  if (eatsAnimals)
    return { trophicLevel: 3, trophicLabel: 'secondary consumer', trophicNote: `Eats animals, preyed upon by ${eatenBy.length} species` };

  // Default for animals with only plant prey or no data
  return {
    trophicLevel: 2,
    trophicLabel: 'primary consumer',
    trophicNote: eatsPlants
      ? `Herbivore — eats ${eats.filter(isPlantPrey).length} plant species`
      : 'Trophic level estimated — no interaction data available',
  };
}

/**
 * Assign trophic levels to an entire species list.
 */
export function assignBulkTrophicLevels(speciesList) {
  return speciesList.map(species => {
    const { trophicLevel, trophicLabel, trophicNote } = assignTrophicLevel(species);
    return { ...species, trophicLevel, trophicLabel, trophicNote };
  });
}
