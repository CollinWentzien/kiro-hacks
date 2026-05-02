/**
 * InteractionService
 *
 * Fetches predator/prey and other ecological relationships from the
 * Global Biotic Interactions (GloBI) public API.
 *
 * API docs: https://www.globalbioticinteractions.org/data
 * Endpoint: https://api.globalbioticinteractions.org/interaction
 */

const GLOBI_URL = 'https://api.globalbioticinteractions.org/interaction';

// GloBI interaction types we care about, mapped to our field names
const INTERACTION_MAP = {
  eats:           'eats',
  eatenBy:        'eatenBy',
  pollinates:     'pollinates',
  pollinatedBy:   'pollinatedBy',
  parasitizes:    'parasitizes',
  parasitizedBy:  'parasitizedBy',
  competesWidth:  'competesWidth', // GloBI uses this spelling
};

// All types to query in one request (GloBI supports comma-separated)
const ALL_TYPES = Object.keys(INTERACTION_MAP).join(',');

/**
 * Fetch all biotic interactions for a single species from GloBI.
 * Returns an object with arrays for each relationship type.
 * On failure, returns empty arrays (non-blocking — interactions are enrichment).
 *
 * @param {string} scientificName
 * @returns {Promise<{
 *   eats: string[],
 *   eatenBy: string[],
 *   pollinates: string[],
 *   pollinatedBy: string[],
 *   parasitizes: string[],
 *   parasitizedBy: string[],
 *   competesWidth: string[]
 * }>}
 */
export async function getSpeciesInteractions(scientificName) {
  const empty = {
    eats: [],
    eatenBy: [],
    pollinates: [],
    pollinatedBy: [],
    parasitizes: [],
    parasitizedBy: [],
    competesWidth: [],
  };

  try {
    const params = new URLSearchParams({
      sourceTaxon: scientificName,
      fields: 'source_taxon_name,target_taxon_name,interaction_type',
      limit: '250',
    });

    const response = await fetch(`${GLOBI_URL}?${params.toString()}`);
    if (!response.ok) return empty;

    const data = await response.json();
    const rows = data.data ?? [];

    // rows is an array of [source_taxon_name, target_taxon_name, interaction_type]
    const result = { ...empty };

    for (const [, targetName, interactionType] of rows) {
      if (!targetName || !interactionType) continue;
      const field = INTERACTION_MAP[interactionType];
      if (field && !result[field].includes(targetName)) {
        result[field].push(targetName);
      }
    }

    return result;
  } catch {
    return empty;
  }
}

/**
 * Fetch interactions for a list of species in parallel, with concurrency
 * limiting to avoid hammering GloBI.
 *
 * @param {string[]} scientificNames
 * @param {number} [concurrency=10]
 * @returns {Promise<Map<string, object>>} Map of lowercased name → interactions
 */
export async function getBulkInteractions(scientificNames, concurrency = 10) {
  const results = new Map();
  const queue = [...scientificNames];

  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    const batchResults = await Promise.all(
      batch.map(async name => {
        const interactions = await getSpeciesInteractions(name);
        return [name.trim().toLowerCase(), interactions];
      })
    );
    for (const [key, val] of batchResults) {
      results.set(key, val);
    }
  }

  return results;
}
