import { Hono } from 'hono';
import { getPlantNativity, getAnimalNativity } from '../services/nativityService.js';
import { cacheService, TTL } from '../services/cacheService.js';

const router = new Hono();

router.get('/', async (c) => {
  const { scientificName, country, state } = c.req.query();

  if (!scientificName) {
    return c.json({ message: 'Missing required parameter: scientificName' }, 400);
  }
  if (!country) {
    return c.json({ message: 'Missing required parameter: country' }, 400);
  }

  const cacheKey = `nativity:${scientificName.toLowerCase()}:${country.toLowerCase()}:${state ?? ''}`;
  const cached = cacheService.get(cacheKey);
  if (cached) return c.json(cached);

  // Attempt plant nativity first via POWO; if it returns a definitive answer use it.
  // Otherwise fall back to animal nativity via NatureServe.
  // A more robust implementation would use enrichment data to determine kingdom.
  const plantResult = await getPlantNativity({ scientificName, country });

  let result;
  if (plantResult.nativeStatus !== 'unknown' || !plantResult.sourceError) {
    result = { scientificName, ...plantResult };
  } else {
    const animalResult = await getAnimalNativity({ scientificName, country, state });
    result = { scientificName, ...animalResult };
  }

  cacheService.set(cacheKey, result, TTL.NATIVITY);
  return c.json(result);
});

export default router;
