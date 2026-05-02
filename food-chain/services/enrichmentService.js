const INAT_TAXA_URL = 'https://api.inaturalist.org/v1/taxa';
const GBIF_MATCH_URL = 'https://api.gbif.org/v1/species/match';

/**
 * Extract the medium photo URL from an iNaturalist taxon object.
 * iNaturalist returns the photo under default_photo.medium_url.
 *
 * @param {object} taxon
 * @returns {string|null}
 */
export function getPhoto(taxon) {
  return taxon?.default_photo?.medium_url ?? null;
}

/**
 * Extract the preferred common name from an iNaturalist taxon object.
 *
 * @param {object} taxon
 * @returns {string|null}
 */
export function getCommonName(taxon) {
  return taxon?.preferred_common_name ?? null;
}

/**
 * Build a taxonomy object from an iNaturalist taxon's ancestors array.
 * The /v1/taxa/{id} endpoint returns an `ancestors` array where each entry
 * has a `rank` field (e.g. "kingdom", "phylum", "class", "order", "family", "genus")
 * and a `name` field.
 *
 * Falls back to iconic_taxon_name for the class-level group when ancestors
 * are not available (e.g. from the search endpoint).
 *
 * @param {object} taxon
 * @param {Array} [ancestors]
 * @returns {object}
 */
export function buildTaxonomy(taxon, ancestors = []) {
  const ranks = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'];
  const taxonomy = Object.fromEntries(ranks.map(r => [r, null]));

  // Populate from ancestors array (available on detail endpoint)
  for (const ancestor of ancestors) {
    const rank = ancestor.rank?.toLowerCase();
    if (ranks.includes(rank)) {
      taxonomy[rank] = ancestor.name;
    }
  }

  // Fill in class from iconic_taxon_name if still missing
  // iNaturalist iconic names map to rough class-level groups
  if (!taxonomy.class && taxon?.iconic_taxon_name) {
    taxonomy.class = taxon.iconic_taxon_name;
  }

  // Fill in genus from the scientific name (first word) if still missing
  if (!taxonomy.genus && taxon?.name) {
    taxonomy.genus = taxon.name.split(' ')[0];
  }

  return taxonomy;
}

/**
 * Fetch full taxon detail (including ancestors) from iNaturalist by taxon ID.
 *
 * @param {number} taxonId
 * @returns {Promise<Array>} ancestors array, or [] on failure
 */
async function fetchInatAncestors(taxonId) {
  try {
    const response = await fetch(
      `${INAT_TAXA_URL}/${taxonId}?all_names=false`,
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.results?.[0]?.ancestors ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch taxon metadata for a scientific name.
 * Tries iNaturalist first; falls back to GBIF if iNaturalist returns no results.
 *
 * @param {string} scientificName
 * @returns {Promise<object>}
 */
export async function getTaxonMetadata(scientificName) {
  let inatError = null;

  // --- Step 1: Try iNaturalist search ---
  try {
    const params = new URLSearchParams({ q: scientificName, rank: 'species' });
    const response = await fetch(`${INAT_TAXA_URL}?${params.toString()}`);

    if (!response.ok) {
      inatError = `iNaturalist returned ${response.status}`;
    } else {
      const data = await response.json();
      const results = data.results ?? [];

      if (results.length > 0) {
        const taxon = results[0];

        // Fetch ancestors for full taxonomy (separate call, non-blocking on failure)
        const ancestors = await fetchInatAncestors(taxon.id);
        const taxonomy = buildTaxonomy(taxon, ancestors);

        return {
          scientificName: taxon.name ?? scientificName,
          commonName: getCommonName(taxon),
          photoUrl: getPhoto(taxon),
          taxonomy,
          observationSummary: taxon.observations_count != null
            ? `${taxon.observations_count.toLocaleString()} observations`
            : null,
          sourceLinks: [
            { source: 'iNaturalist', url: `https://www.inaturalist.org/taxa/${taxon.id}` },
          ],
          sources: ['iNaturalist'],
        };
      }
      // iNaturalist returned empty results — fall through to GBIF
    }
  } catch (err) {
    inatError = err.message;
  }

  // --- Step 2: Try GBIF as fallback ---
  let gbifError = null;

  try {
    const params = new URLSearchParams({ name: scientificName });
    const response = await fetch(`${GBIF_MATCH_URL}?${params.toString()}`);

    if (!response.ok) {
      gbifError = `GBIF returned ${response.status}`;
    } else {
      const data = await response.json();

      // GBIF returns matchType: 'NONE' when no match found
      if (!data.usageKey || data.matchType === 'NONE') {
        if (inatError) return { error: true, message: inatError };
        return { notFound: true };
      }

      return {
        scientificName: data.canonicalName ?? scientificName,
        commonName: data.vernacularName ?? null,
        photoUrl: null,
        taxonomy: {
          kingdom: data.kingdom ?? null,
          phylum: data.phylum ?? null,
          class: data.class ?? null,
          order: data.order ?? null,
          family: data.family ?? null,
          genus: data.genus ?? null,
        },
        observationSummary: null,
        sourceLinks: [
          { source: 'GBIF', url: `https://www.gbif.org/species/${data.usageKey}` },
        ],
        sources: ['GBIF'],
      };
    }
  } catch (err) {
    gbifError = err.message;
  }

  if (inatError && gbifError) return { error: true, message: inatError };
  if (inatError) return { error: true, message: inatError };
  if (gbifError) return { error: true, message: gbifError };

  return { notFound: true };
}
