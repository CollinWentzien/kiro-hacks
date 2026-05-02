import { Hono } from 'hono';
import { getTaxonMetadata } from '../services/enrichmentService.js';
import { cacheService, TTL } from '../services/cacheService.js';

const router = new Hono();

router.get('/', async (c) => {
  const { scientificName } = c.req.query();

  if (!scientificName) {
    return c.json({ message: 'Missing required parameter: scientificName' }, 400);
  }

  const cacheKey = `enrichment:${scientificName.trim().toLowerCase()}`;
  const cached = cacheService.get(cacheKey);
  if (cached) return c.json(cached);

  const result = await getTaxonMetadata(scientificName);

  if (result.notFound) return c.json({ message: 'Species not found' }, 404);
  if (result.error) return c.json({ message: result.message }, 502);

  cacheService.set(cacheKey, result, TTL.ENRICHMENT);
  return c.json(result);
});

export default router;
