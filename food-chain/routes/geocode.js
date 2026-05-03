import { Hono } from 'hono';
import { geocodeCity } from '../services/geocodingService.js';
import { cacheService, TTL } from '../services/cacheService.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const PHOTON_URL = 'https://photon.komoot.io/api';
const USER_AGENT = 'ecosystem-builder/1.0';

// Photon osm_value types to include (cities, towns, villages — not counties/states)
const CITY_OSM_VALUES = new Set([
  'city', 'town', 'village', 'municipality', 'suburb',
  'quarter', 'hamlet', 'borough',
]);

const router = new Hono();

router.get('/', async (c) => {
  const { city, country, state } = c.req.query();

  if (!city) {
    return c.json({ message: 'Missing required parameter: city' }, 400);
  }

  const cacheKey = `geocode:${city.toLowerCase()}:${country ?? ''}:${state ?? ''}`;
  const cached = cacheService.get(cacheKey);
  if (cached) return c.json(cached);

  const result = await geocodeCity({ city, country, state });

  if (result.notFound) return c.json({ message: 'City not found' }, 404);
  if (result.error) return c.json({ message: result.message }, 502);

  cacheService.set(cacheKey, result, TTL.GEOCODE);
  return c.json(result);
});

/**
 * GET /api/geocode/autocomplete?q=aust&limit=8
 *
 * Returns city suggestions for a partial search string.
 * Used to power the city search bar on the home page.
 *
 * Query params:
 *   q       - partial city name (required, min 2 chars)
 *   limit   - max suggestions (default 8, max 15)
 *
 * Response:
 * [
 *   {
 *     "city": "Austin",
 *     "state": "Texas",
 *     "country": "United States",
 *     "displayName": "Austin, Texas, United States",
 *     "lat": 30.2711,
 *     "lng": -97.7437
 *   }
 * ]
 */
router.get('/autocomplete', async (c) => {
  const { q, limit } = c.req.query();

  if (!q || q.trim().length < 2) {
    return c.json({ message: 'Query must be at least 2 characters' }, 400);
  }

  const lim = Math.min(Number(limit) || 8, 15);
  const cacheKey = `autocomplete:${q.trim().toLowerCase()}:${lim}`;
  const cached = cacheService.get(cacheKey);
  if (cached) return c.json(cached);

  try {
    const params = new URLSearchParams({
      q: q.trim(),
      limit: '20',
      layer: 'city',
    });

    const response = await fetch(`${PHOTON_URL}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      return c.json({ message: `Autocomplete service returned ${response.status}` }, 502);
    }

    const data = await response.json();
    const features = data.features ?? [];

    const suggestions = features
      .filter(f => CITY_OSM_VALUES.has(f.properties?.osm_value))
      .slice(0, lim)
      .map(f => {
        const p = f.properties;
        const [lng, lat] = f.geometry.coordinates;
        const city = p.name || null;
        const state = p.state || null;
        const country = p.country || null;
        const parts = [city, state, country].filter(Boolean);

        return {
          city,
          state,
          country,
          displayName: parts.join(', '),
          lat,
          lng,
        };
      })
      // Remove duplicates by displayName
      .filter((item, index, arr) =>
        item.city && arr.findIndex(x => x.displayName === item.displayName) === index
      );

    cacheService.set(cacheKey, suggestions, TTL.GEOCODE);
    return c.json(suggestions);
  } catch (err) {
    return c.json({ message: err.message }, 502);
  }
});

export default router;

