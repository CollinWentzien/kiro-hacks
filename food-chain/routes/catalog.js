import { Hono } from 'hono';
import { searchCatalog, scoreCompatibility } from '../services/catalogService.js';
import { analyzeGaps, scoreAgainstGaps } from '../services/gapAnalysisService.js';
import { getSpeciesInteractions } from '../services/interactionService.js';
import { loadCityData, citySlug } from '../services/persistenceService.js';
import { cacheService, TTL } from '../services/cacheService.js';

const router = new Hono();

/**
 * GET /api/catalog/search
 *
 * Search the global species catalog with optional fast gap-based scoring.
 *
 * Query params:
 *   q           - free text search (common or scientific name)
 *   category    - 'plant' | 'animal'
 *   kingdom     - iNaturalist iconic taxon (e.g. 'Plantae', 'Aves', 'Mammalia')
 *   limit       - max results (default 30, max 200)
 *   page        - page number (default 1)
 *   city        - score against a saved city ecosystem (fast, no GloBI calls)
 *   country     - used with city
 *   state       - used with city
 *   deepScore   - 'true' to also fetch GloBI interactions per candidate (slower, more accurate)
 */
router.get('/search', async (c) => {
  const { q, category, kingdom, limit, page, city, country, state, deepScore } = c.req.query();

  if (!q && !category && !kingdom) {
    return c.json({ message: 'Provide at least one of: q, category, or kingdom' }, 400);
  }

  const lim = Math.min(Number(limit) || 30, 200);
  const pg = Number(page) || 1;

  const searchCacheKey = `catalog:${q ?? ''}:${category ?? ''}:${kingdom ?? ''}:${lim}:${pg}`;
  let searchResult = cacheService.get(searchCacheKey);

  if (!searchResult) {
    searchResult = await searchCatalog({ q, category, kingdom, limit: lim, page: pg });
    if (searchResult.error) return c.json({ message: searchResult.message }, 502);
    cacheService.set(searchCacheKey, searchResult, TTL.ENRICHMENT);
  }

  let results = searchResult.results;

  if (city) {
    const slug = citySlug(city, country, state);
    const cityData = await loadCityData(slug);

    if (cityData?.species?.length > 0) {
      results = await applyScoring(results, cityData.species, deepScore === 'true');
    }
  }

  return c.json({ results, totalResults: searchResult.totalResults, page: pg, limit: lim });
});

/**
 * POST /api/catalog/search
 *
 * Same as GET but accepts a custom species list in the body for
 * user-built ecosystems that aren't tied to a saved city.
 *
 * Body: {
 *   q?: string,
 *   category?: string,
 *   kingdom?: string,
 *   limit?: number,
 *   page?: number,
 *   deepScore?: boolean,
 *   species: Array   ← the user's current ecosystem species list
 * }
 */
router.post('/search', async (c) => {
  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ message: 'Invalid JSON body' }, 400);
  }

  const { q, category, kingdom, deepScore } = body;
  const lim = Math.min(Number(body.limit) || 30, 200);
  const pg = Number(body.page) || 1;
  const ecosystemSpecies = Array.isArray(body.species) ? body.species : [];

  if (!q && !category && !kingdom) {
    return c.json({ message: 'Provide at least one of: q, category, or kingdom' }, 400);
  }

  const searchCacheKey = `catalog:${q ?? ''}:${category ?? ''}:${kingdom ?? ''}:${lim}:${pg}`;
  let searchResult = cacheService.get(searchCacheKey);

  if (!searchResult) {
    searchResult = await searchCatalog({ q, category, kingdom, limit: lim, page: pg });
    if (searchResult.error) return c.json({ message: searchResult.message }, 502);
    cacheService.set(searchCacheKey, searchResult, TTL.ENRICHMENT);
  }

  let results = searchResult.results;

  if (ecosystemSpecies.length > 0) {
    results = await applyScoring(results, ecosystemSpecies, deepScore === true);
  }

  return c.json({ results, totalResults: searchResult.totalResults, page: pg, limit: lim });
});

/**
 * GET /api/catalog/species/:id
 *
 * Full detail for a single species by iNaturalist taxon ID.
 *
 * Optional: pass ?city=Austin&state=Texas&country=United+States to also
 * get a compatibility score against that city's ecosystem.
 */
router.get('/species/:id', async (c) => {
  const { id } = c.req.param();
  const { city, country, state } = c.req.query();
  const taxonId = Number(id);

  if (!taxonId) return c.json({ message: 'Invalid taxon ID' }, 400);

  const cacheKey = `catalog:species:${taxonId}`;
  let result = cacheService.get(cacheKey);

  if (!result) {
    try {
      const taxonRes = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
      if (!taxonRes.ok) return c.json({ message: 'Species not found' }, 404);

      const taxonData = await taxonRes.json();
      const taxon = taxonData.results?.[0];
      if (!taxon) return c.json({ message: 'Species not found' }, 404);

      // Build taxonomy from ancestors
      const ancestors = taxon.ancestors ?? [];
      const ranks = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus'];
      const taxonomy = Object.fromEntries(ranks.map(r => [r, null]));
      for (const ancestor of ancestors) {
        const rank = ancestor.rank?.toLowerCase();
        if (ranks.includes(rank)) taxonomy[rank] = ancestor.name;
      }
      if (!taxonomy.class && taxon.iconic_taxon_name) taxonomy.class = taxon.iconic_taxon_name;
      if (!taxonomy.genus && taxon.name) taxonomy.genus = taxon.name.split(' ')[0];

      const interactions = await getSpeciesInteractions(taxon.name);
      const PLANT_TAXA = new Set(['Plantae', 'Fungi', 'Chromista']);

      result = {
        scientificName: taxon.name,
        commonName: taxon.preferred_common_name ?? null,
        category: PLANT_TAXA.has(taxon.iconic_taxon_name) ? 'plant' : 'animal',
        photoUrl: taxon.default_photo?.medium_url ?? null,
        observationCount: taxon.observations_count ?? 0,
        inatTaxonId: taxon.id,
        wikipediaUrl: taxon.wikipedia_url ?? null,
        iconicTaxonName: taxon.iconic_taxon_name ?? null,
        taxonomy,
        interactions,
        observationSummary: taxon.observations_count
          ? `${taxon.observations_count.toLocaleString()} observations`
          : null,
        sourceLinks: [
          { source: 'iNaturalist', url: `https://www.inaturalist.org/taxa/${taxon.id}` },
        ],
      };

      cacheService.set(cacheKey, result, TTL.ENRICHMENT);
    } catch (err) {
      return c.json({ message: err.message }, 502);
    }
  }

  // If city provided, add deep compatibility score using GloBI data we already have
  if (city) {
    const slug = citySlug(city, country, state);
    const cityData = await loadCityData(slug);
    if (cityData?.species?.length > 0) {
      const { score, label, reasons } = scoreCompatibility(
        result,
        cityData.species,
        result.interactions
      );
      return c.json({ ...result, compatibilityScore: score, compatibilityLabel: label, compatibilityReasons: reasons });
    }
  }

  return c.json(result);
});

// ---------------------------------------------------------------------------
// Shared scoring helper
// ---------------------------------------------------------------------------

/**
 * Score and sort a list of catalog results against an ecosystem species list.
 *
 * Fast mode (default): uses gap profile only — no external API calls.
 * Deep mode (deepScore=true): also fetches GloBI interactions per candidate.
 *
 * @param {Array}   results          - catalog search results
 * @param {Array}   ecosystemSpecies - current ecosystem species
 * @param {boolean} deep             - whether to fetch GloBI per candidate
 * @returns {Promise<Array>}
 */
async function applyScoring(results, ecosystemSpecies, deep = false) {
  const gapProfile = analyzeGaps(ecosystemSpecies);
  const ecoNames = new Set(gapProfile.ecosystemNames);

  // Exclude species already in the ecosystem
  const candidates = results.filter(
    s => !ecoNames.has(s.scientificName.trim().toLowerCase())
  );

  if (!deep) {
    // Fast path: score using gap profile only (no API calls)
    return candidates
      .map(s => {
        const { score, label, reasons } = scoreAgainstGaps(s, gapProfile);
        return { ...s, compatibilityScore: score, compatibilityLabel: label, compatibilityReasons: reasons };
      })
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  }

  // Deep path: fetch GloBI interactions per candidate then use full scorer
  const BATCH = 10;
  const interactionMap = new Map();
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    await Promise.all(batch.map(async s => {
      const key = s.scientificName.trim().toLowerCase();
      const interactions = await getSpeciesInteractions(s.scientificName);
      interactionMap.set(key, interactions);
    }));
  }

  return candidates
    .map(s => {
      const key = s.scientificName.trim().toLowerCase();
      const interactions = interactionMap.get(key) ?? null;
      const { score, label, reasons } = scoreCompatibility(s, ecosystemSpecies, interactions);
      return { ...s, compatibilityScore: score, compatibilityLabel: label, compatibilityReasons: reasons };
    })
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
}

export default router;
