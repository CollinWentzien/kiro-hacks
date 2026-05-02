const POWO_URL = 'https://powo.science.kew.org/api/2/taxon/search';
const NATURESERVE_URL = 'https://explorer.natureserve.org/api/data/speciesSearch';

// Countries considered US or Canada for NatureServe routing
const US_CA_COUNTRIES = new Set(['united states', 'usa', 'us', 'canada', 'ca']);

/**
 * Determine if a country string matches US or Canada.
 *
 * @param {string} country
 * @returns {boolean}
 */
function isUsOrCanada(country) {
  return US_CA_COUNTRIES.has(country.trim().toLowerCase());
}

/**
 * Determine native status for a plant species using POWO.
 *
 * @param {{ scientificName: string, country: string }} params
 * @returns {Promise<object>}
 */
export async function getPlantNativity({ scientificName, country }) {
  const params = new URLSearchParams({
    q: scientificName,
    f: 'species_name',
  });

  const url = `${POWO_URL}?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return {
        nativeStatus: 'unknown',
        confidence: 'unknown',
        sourceError: `POWO returned ${response.status}`,
        sources: [],
      };
    }

    const data = await response.json();
    const results = data.results ?? [];

    if (results.length === 0) {
      return { nativeStatus: 'unknown', confidence: 'unknown', sources: ['POWO'] };
    }

    // Check if the country appears in native distributions of the first accepted result
    const result = results.find(r => r.accepted !== false) ?? results[0];
    const nativeDistributions = result.nativeDistributions ?? [];

    const countryLower = country.trim().toLowerCase();
    const isNative = nativeDistributions.some(
      dist => (typeof dist === 'string' ? dist : dist.name ?? dist.tdwgCode ?? '')
        .toLowerCase()
        .includes(countryLower)
    );

    return {
      nativeStatus: isNative ? 'native' : 'non-native',
      confidence: 'high',
      sources: ['POWO'],
    };
  } catch (err) {
    return {
      nativeStatus: 'unknown',
      confidence: 'unknown',
      sourceError: err.message,
      sources: [],
    };
  }
}

/**
 * Determine native status for an animal species.
 * Routes to NatureServe for US/Canada; returns unknown otherwise.
 *
 * @param {{ scientificName: string, country: string, state?: string }} params
 * @returns {Promise<object>}
 */
export async function getAnimalNativity({ scientificName, country, state }) {
  if (!isUsOrCanada(country)) {
    return { nativeStatus: 'unknown', confidence: 'unknown', sources: [] };
  }

  return getNatureServeStatus({ scientificName, state });
}

/**
 * Query NatureServe for native status of a species.
 *
 * @param {{ scientificName: string, state?: string }} params
 * @returns {Promise<object>}
 */
export async function getNatureServeStatus({ scientificName, state }) {
  const body = {
    criteriaType: 'species',
    textCriteria: [
      {
        paramType: 'scientificOrCommonName',
        searchToken: scientificName,
      },
    ],
  };

  try {
    const response = await fetch(NATURESERVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        nativeStatus: 'unknown',
        confidence: 'unknown',
        sourceError: `NatureServe returned ${response.status}`,
        sources: [],
      };
    }

    const data = await response.json();
    const hits = data.results ?? data.hits ?? [];

    if (hits.length === 0) {
      return { nativeStatus: 'unknown', confidence: 'unknown', sources: ['NatureServe'] };
    }

    const species = hits[0];
    const globalRank = species.globalRank ?? species.roundedGRank ?? '';

    return {
      ...scoreNativeConfidence(globalRank),
      sources: ['NatureServe'],
    };
  } catch (err) {
    return {
      nativeStatus: 'unknown',
      confidence: 'unknown',
      sourceError: err.message,
      sources: [],
    };
  }
}

/**
 * Map a NatureServe global rank string to nativeStatus and confidence.
 *
 * @param {string} rank - e.g. 'G1', 'G3', 'G5', 'GX', 'GH'
 * @returns {{ nativeStatus: string, confidence: string }}
 */
export function scoreNativeConfidence(rank) {
  if (!rank) {
    return { nativeStatus: 'unknown', confidence: 'unknown' };
  }

  const upper = rank.toUpperCase().trim();

  if (upper === 'GX' || upper === 'GH') {
    return { nativeStatus: 'non-native', confidence: 'high' };
  }

  // G1-G3: critically imperiled to vulnerable — native with high confidence
  if (/^G[1-3]/.test(upper)) {
    return { nativeStatus: 'native', confidence: 'high' };
  }

  // G4-G5: apparently secure to secure — native with medium confidence
  if (/^G[4-5]/.test(upper)) {
    return { nativeStatus: 'native', confidence: 'medium' };
  }

  return { nativeStatus: 'unknown', confidence: 'unknown' };
}
