// Integration tests — make real network calls
// These can be skipped in CI by setting SKIP_INTEGRATION=true
import { describe, it, expect } from 'vitest';
import { geocodeCity } from './geocodingService.js';
import { app } from '../index.js';

const skip = process.env.SKIP_INTEGRATION === 'true';

describe.skipIf(skip)('Integration: GeocodingService', () => {
  it('resolves San Luis Obispo to correct coordinates', async () => {
    const result = await geocodeCity({
      city: 'San Luis Obispo',
      state: 'California',
      country: 'United States',
    });

    expect(result.notFound).toBeUndefined();
    expect(result.error).toBeUndefined();
    expect(typeof result.lat).toBe('number');
    expect(typeof result.lng).toBe('number');
    expect(result.city).toBeTruthy();
    expect(result.country).toBeTruthy();
  });
});

describe.skipIf(skip)('Integration: GET /api/ecosystem', () => {
  it('returns region and species array for a known city', async () => {
    const req = new Request('http://localhost/api/ecosystem?city=San+Luis+Obispo&state=California&country=United+States&limit=5');
    const res = await app.fetch(req);

    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body).toHaveProperty('region');
    expect(body).toHaveProperty('species');
    expect(Array.isArray(body.species)).toBe(true);

    expect(typeof body.region.lat).toBe('number');
    expect(typeof body.region.lng).toBe('number');
    expect(body.region.city).toBeTruthy();
    expect(body.region.country).toBeTruthy();

    // Each species should have required fields
    for (const species of body.species) {
      expect(species).toHaveProperty('scientificName');
      expect(species).toHaveProperty('category');
      expect(species).toHaveProperty('observedNearby');
      expect(species).toHaveProperty('nativeStatus');
      expect(species).toHaveProperty('confidence');
      expect(species).toHaveProperty('sources');
      expect(Array.isArray(species.sources)).toBe(true);
    }
  });
});
