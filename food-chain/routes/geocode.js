import { Hono } from 'hono';
import { geocodeCity } from '../services/geocodingService.js';
import { cacheService, TTL } from '../services/cacheService.js';

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

export default router;
