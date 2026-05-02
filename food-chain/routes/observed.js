import { Hono } from 'hono';
import {
  getGbifObservedSpecies,
  getINatObservedSpecies,
  mergeObservedSpecies,
} from '../services/observationService.js';
import { cacheService, TTL } from '../services/cacheService.js';

const router = new Hono();

router.get('/', async (c) => {
  const { lat, lng, radiusKm, categories, limit } = c.req.query();

  if (!lat) return c.json({ message: 'Missing required parameter: lat' }, 400);
  if (!lng) return c.json({ message: 'Missing required parameter: lng' }, 400);

  const radius = Number(radiusKm) || 50;
  const lim = Number(limit) || 100;
  const cats = categories ? categories.split(',').map(s => s.trim()) : null;

  const cacheKey = `observed:${lat}:${lng}:${radius}:${cats?.join(',') ?? ''}`;
  const cached = cacheService.get(cacheKey);
  if (cached) return c.json(cached);

  const [gbif, inat] = await Promise.all([
    getGbifObservedSpecies({ lat: Number(lat), lng: Number(lng), radiusKm: radius, limit: lim }),
    getINatObservedSpecies({ lat: Number(lat), lng: Number(lng), radiusKm: radius, limit: lim }),
  ]);

  const merged = mergeObservedSpecies(gbif, inat);
  if (merged.error) return c.json({ message: merged.message }, 502);

  let species = merged.species;
  if (cats) species = species.filter(s => cats.includes(s.category));
  species = species.slice(0, lim);

  const response = {
    species,
    ...(merged.partialFailure ? { partialFailure: true } : {}),
  };

  cacheService.set(cacheKey, response, TTL.OBSERVED);
  return c.json(response);
});

export default router;
