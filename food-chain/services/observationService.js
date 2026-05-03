/**
 * ObservationService
 *
 * Fetches unique observed species near a location from:
 *   - iNaturalist /v1/observations/species_counts  (returns unique species directly)
 *   - GBIF        /v1/occurrence/search             (bounding box, deduplicated by species)
 */

const GBIF_URL = 'https://api.gbif.org/v1/occurrence/search';
const INAT_SPECIES_URL = 'https://api.inaturalist.org/v1/observations/species_counts';

const INAT_PAGE_SIZE = 200; // iNaturalist max per_page
const GBIF_PAGE_SIZE = 300; // GBIF max limit per request

/**
 * Convert km radius to a lat/lng bounding box.
 * 1 degree lat ≈ 111 km; 1 degree lng ≈ 111 km * cos(lat)
 */
function radiusToBbox(lat, lng, radiusKm) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/**
 * Fetch unique observed species from iNaturalist using the species_counts endpoint.
 * This returns one record per unique species (not one per observation), sorted by
 * observation count descending.
 *
 * The taxon object already includes default_photo, preferred_common_name, and
 * observations_count — so no separate enrichment call is needed for these fields.
 *
 * @param {{ lat: number, lng: number, radiusKm?: number, limit?: number }} params
 * @returns {Promise<Array|{ error: true, message: string }>}
 */
export async function getINatObservedSpecies({ lat, lng, radiusKm = 50, limit = 500 }) {
  const seen = new Map();
  let page = 1;

  try {
    while (seen.size < limit) {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radius: String(radiusKm),
        per_page: String(Math.min(INAT_PAGE_SIZE, limit - seen.size)),
        page: String(page),
        quality_grade: 'research',
        order_by: 'observations_count',
      });

      const response = await fetch(`${INAT_SPECIES_URL}?${params.toString()}`);
      if (!response.ok) return { error: true, message: `iNaturalist returned ${response.status}` };

      const data = await response.json();
      const results = data.results ?? [];

      for (const entry of results) {
        const taxon = entry.taxon;
        if (!taxon?.name) continue;

        const key = taxon.name.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, {
            scientificName: taxon.name,
            commonName: taxon.preferred_common_name ?? null,
            category: taxon.iconic_taxon_name === 'Plantae' ? 'plant' : 'animal',
            observedNearby: true,
            observationCount: entry.count ?? taxon.observations_count ?? 1,
            photoUrl: taxon.default_photo?.medium_url ?? null,
            inatTaxonId: taxon.id,
            sources: ['iNaturalist'],
          });
        }
      }

      // Stop if last page or reached limit
      if (results.length < INAT_PAGE_SIZE || seen.size >= limit) break;
      page++;
    }

    return [...seen.values()];
  } catch (err) {
    return { error: true, message: err.message };
  }
}

/**
 * Fetch observed species from GBIF near a location using a bounding box.
 * Paginates to collect up to `limit` unique species.
 *
 * @param {{ lat: number, lng: number, radiusKm?: number, limit?: number }} params
 * @returns {Promise<Array|{ error: true, message: string }>}
 */
export async function getGbifObservedSpecies({ lat, lng, radiusKm = 50, limit = 500 }) {
  const seen = new Map();
  let offset = 0;
  const bbox = radiusToBbox(lat, lng, radiusKm);

  try {
    while (seen.size < limit) {
      const params = new URLSearchParams({
        decimalLatitude: `${bbox.minLat},${bbox.maxLat}`,
        decimalLongitude: `${bbox.minLng},${bbox.maxLng}`,
        limit: String(Math.min(GBIF_PAGE_SIZE, limit - seen.size + 50)), // fetch extra to account for no-species records
        offset: String(offset),
        hasCoordinate: 'true',
        hasGeospatialIssue: 'false',
      });

      const response = await fetch(`${GBIF_URL}?${params.toString()}`);
      if (!response.ok) return { error: true, message: `GBIF returned ${response.status}` };

      const data = await response.json();
      const results = (data.results ?? []).filter(r => r.species);

      for (const r of results) {
        const key = r.species.trim().toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, {
            scientificName: r.species,
            commonName: r.vernacularName ?? null,
            category: r.kingdom === 'Plantae' ? 'plant' : 'animal',
            observedNearby: true,
            observationCount: 1,
            photoUrl: null, // GBIF occurrences don't include photos
            sources: ['GBIF'],
          });
        }
      }

      // Stop if last page or reached limit
      if (results.length < GBIF_PAGE_SIZE || seen.size >= limit) break;
      offset += GBIF_PAGE_SIZE;
    }

    return [...seen.values()];
  } catch (err) {
    return { error: true, message: err.message };
  }
}

/**
 * Merge results from GBIF and iNaturalist, deduplicating on scientific name.
 * iNaturalist data takes priority (has photos, common names, observation counts).
 *
 * @param {Array|{ error: true, message: string }} gbifResults
 * @param {Array|{ error: true, message: string }} inatResults
 * @returns {{ species: Array, partialFailure?: true }|{ error: true, message: string }}
 */
export function mergeObservedSpecies(gbifResults, inatResults) {
  const gbifError = !Array.isArray(gbifResults) && gbifResults?.error;
  const inatError = !Array.isArray(inatResults) && inatResults?.error;

  if (gbifError && inatError) {
    return { error: true, message: 'Both observation sources failed' };
  }

  const partialFailure = gbifError || inatError;
  const map = new Map();

  // Add iNaturalist first (higher quality — has photos, common names, counts)
  if (Array.isArray(inatResults)) {
    for (const record of inatResults) {
      const key = record.scientificName.trim().toLowerCase();
      map.set(key, { ...record });
    }
  }

  // Add GBIF — only for species not already in iNaturalist
  if (Array.isArray(gbifResults)) {
    for (const record of gbifResults) {
      const key = record.scientificName.trim().toLowerCase();
      if (map.has(key)) {
        // Merge sources only
        const existing = map.get(key);
        const sources = [...new Set([...existing.sources, ...record.sources])];
        map.set(key, { ...existing, sources });
      } else {
        map.set(key, { ...record });
      }
    }
  }

  const species = [...map.values()];
  return partialFailure ? { species, partialFailure: true } : { species };
}
