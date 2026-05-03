import { Hono } from 'hono';
import { geocodeCity } from '../services/geocodingService.js';
import {
  getGbifObservedSpecies,
  getINatObservedSpecies,
  mergeObservedSpecies,
} from '../services/observationService.js';
import { getPlantNativity } from '../services/nativityService.js';
import { getTaxonMetadata } from '../services/enrichmentService.js';
import { mergeSpeciesRecords } from '../services/mergeService.js';
import { getBulkInteractions } from '../services/interactionService.js';
import { assignBulkTrophicLevels } from '../services/trophicService.js';
import { getCityClimate, classifySpeciesClimateCompatibility } from '../services/climateService.js';
import { analyzeGaps } from '../services/gapAnalysisService.js';
import { cacheService, TTL } from '../services/cacheService.js';
import { citySlug, saveCityData, loadCityData, listSavedCities } from '../services/persistenceService.js';

const router = new Hono();

// GET /api/ecosystem?city=Austin&country=US&state=Texas&radiusKm=50&...
router.get('/', async (c) => {
  const {
    city,
    country,
    state,
    radiusKm,
    categories,
    nativeOnly,
    observedOnly,
    confidence,
    limit,
    refresh, // pass refresh=true to bypass disk cache and re-fetch
  } = c.req.query();

  if (!city) {
    return c.json({ message: 'Missing required parameter: city' }, 400);
  }

  const radius = Number(radiusKm) || 50;
  const lim = Number(limit) || 500;  // default 500 species
  const cats = categories ? categories.split(',').map(s => s.trim()) : null;
  const confidenceFilter = confidence ? confidence.split(',').map(s => s.trim()) : null;
  const forceRefresh = refresh === 'true';

  const slug = citySlug(city, country, state);
  const memCacheKey = `ecosystem:${slug}:${radius}`;

  // --- 1. Memory cache (fastest) ---
  const memCached = !forceRefresh && cacheService.get(memCacheKey);
  if (memCached) {
    return c.json(applyFilters(memCached, { nativeOnly, observedOnly, confidenceFilter, cats, lim }));
  }

  // --- 2. Disk cache (persisted across restarts) ---
  if (!forceRefresh) {
    const diskCached = await loadCityData(slug);
    if (diskCached) {
      // Warm the memory cache from disk
      cacheService.set(memCacheKey, diskCached, TTL.ECOSYSTEM);
      return c.json(applyFilters(diskCached, { nativeOnly, observedOnly, confidenceFilter, cats, lim }));
    }
  }

  // --- 3. Full pipeline ---

  // Step 1: Geocode
  const region = await geocodeCity({ city, country, state });
  if (region.notFound) return c.json({ message: 'City not found' }, 404);
  if (region.error) return c.json({ message: region.message }, 502);

  // Step 2: Observe (GBIF + iNaturalist in parallel)
  const [gbif, inat] = await Promise.all([
    getGbifObservedSpecies({ lat: region.lat, lng: region.lng, radiusKm: radius, limit: lim }),
    getINatObservedSpecies({ lat: region.lat, lng: region.lng, radiusKm: radius, limit: lim }),
  ]);

  const merged = mergeObservedSpecies(gbif, inat);
  if (merged.error) return c.json({ message: 'Observation sources unavailable' }, 502);

  const observedSpecies = merged.species;

  // Steps 3+4: Nativity and enrichment in parallel per species
  const [nativityResults, enrichmentResults] = await Promise.all([
    Promise.all(
      observedSpecies.map(s =>
        getPlantNativity({ scientificName: s.scientificName, country: region.country ?? '' })
          .then(r => [s.scientificName.trim().toLowerCase(), r])
      )
    ),
    Promise.all(
      observedSpecies.map(s =>
        getTaxonMetadata(s.scientificName)
          .then(r => [s.scientificName.trim().toLowerCase(), r])
      )
    ),
  ]);

  const nativityMap = new Map(nativityResults);
  const enrichmentMap = new Map(
    enrichmentResults.filter(([, r]) => !r.error && !r.notFound)
  );

  // Step 5: Merge into full species records (includes taxonomy, photos, etc.)
  let species = mergeSpeciesRecords(observedSpecies, nativityMap, enrichmentMap);

  // Step 6: Fetch biotic interactions from GloBI and embed on each species record
  const scientificNames = species.map(s => s.scientificName);
  const interactionMap = await getBulkInteractions(scientificNames);

  species = species.map(s => {
    const key = s.scientificName.trim().toLowerCase();
    const interactions = interactionMap.get(key) ?? {
      eats: [], eatenBy: [], pollinates: [], pollinatedBy: [],
      parasitizes: [], parasitizedBy: [], competesWidth: [],
    };
    return { ...s, interactions };
  });

  // Step 7: Assign trophic levels + fetch city climate profile in parallel
  const [speciesWithTrophic, climateProfile] = await Promise.all([
    Promise.resolve(assignBulkTrophicLevels(species)),
    getCityClimate(region.lat, region.lng),
  ]);
  species = speciesWithTrophic;

  // Step 8: Classify climate compatibility for each species
  const cityClimate = climateProfile.error ? null : climateProfile;
  species = species.map(s => {
    const { climateCompatibility, climateNote } = classifySpeciesClimateCompatibility(s, cityClimate);
    return { ...s, climateCompatibility, climateNote };
  });

  const payload = {
    region,
    climateProfile: cityClimate,
    species,
    savedAt: new Date().toISOString(),
  };

  // --- 4. Persist to disk and warm memory cache ---
  await saveCityData(slug, payload);
  cacheService.set(memCacheKey, payload, TTL.ECOSYSTEM);

  return c.json(applyFilters(payload, { nativeOnly, observedOnly, confidenceFilter, cats, lim }));
});

// GET /api/ecosystem/saved — list all cities that have been saved to disk
router.get('/saved', async (c) => {
  const slugs = await listSavedCities();
  return c.json({ cities: slugs });
});

/**
 * GET /api/ecosystem/gaps?city=Austin&state=Texas&country=United+States
 * POST /api/ecosystem/gaps  body: { species: [...] }
 *
 * Analyzes the current ecosystem and returns a gap profile describing
 * what trophic roles, taxonomic groups, and interaction types are missing.
 *
 * Used by the frontend to enable fast live compatibility scoring without
 * per-candidate GloBI calls.
 */
router.get('/gaps', async (c) => {
  const { city, country, state } = c.req.query();
  if (!city) return c.json({ message: 'Missing required parameter: city' }, 400);

  const slug = citySlug(city, country, state);
  const cityData = await loadCityData(slug);
  if (!cityData) return c.json({ message: 'City not found — fetch it first via /api/ecosystem' }, 404);

  const profile = analyzeGaps(cityData.species);
  return c.json({ region: cityData.region, gapProfile: profile });
});

router.post('/gaps', async (c) => {
  let body;
  try { body = await c.req.json(); } catch {
    return c.json({ message: 'Invalid JSON body' }, 400);
  }

  const species = body?.species;
  if (!Array.isArray(species)) {
    return c.json({ message: 'Body must contain a "species" array' }, 400);
  }

  const profile = analyzeGaps(species);
  return c.json({ gapProfile: profile });
});

/**
 * Apply post-fetch filters and limit to a payload.
 * The full unfiltered data is what gets cached/saved; filters are applied per-request.
 */
function applyFilters(payload, { nativeOnly, observedOnly, confidenceFilter, cats, lim }) {
  let species = payload.species;

  if (nativeOnly === 'true') species = species.filter(s => s.nativeStatus === 'native');
  if (observedOnly === 'true') species = species.filter(s => s.observedNearby);
  if (confidenceFilter) species = species.filter(s => confidenceFilter.includes(s.confidence));
  if (cats) species = species.filter(s => cats.includes(s.category));

  return {
    region: payload.region,
    climateProfile: payload.climateProfile ?? null,
    species: species.slice(0, lim),
    savedAt: payload.savedAt,
  };
}

/**
 * GET /api/ecosystem/climate?city=Austin&state=Texas&country=United+States
 * Returns the saved climate profile for a city without re-fetching.
 */
router.get('/climate', async (c) => {
  const { city, country, state } = c.req.query();
  if (!city) return c.json({ message: 'Missing required parameter: city' }, 400);

  const slug = citySlug(city, country, state);
  const cityData = await loadCityData(slug);
  if (!cityData) {
    return c.json({ message: 'City not found — fetch it first via /api/ecosystem' }, 404);
  }

  return c.json({
    region: cityData.region,
    climateProfile: cityData.climateProfile ?? null,
  });
});

export default router;
