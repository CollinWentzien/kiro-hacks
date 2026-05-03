import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCityClimate, classifySpeciesClimateCompatibility } from './climateService.js';

const mockJson = (data) => ({ ok: true, json: async () => data });
const mockError = (status) => ({ ok: false, status });

// Build fake daily arrays for 20 years (7300 days)
function fakeClimateData({ maxTemp = 35, minTemp = 5, precipPerDay = 2 } = {}) {
  const days = 7300;
  return {
    daily: {
      temperature_2m_max: Array(days).fill(maxTemp),
      temperature_2m_min: Array(days).fill(minTemp),
      precipitation_sum: Array(days).fill(precipPerDay),
    },
  };
}

describe('ClimateService', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  describe('getCityClimate', () => {
    it('returns climate profile with correct computed values', async () => {
      fetch.mockResolvedValueOnce(mockJson(fakeClimateData({ maxTemp: 35, minTemp: 5, precipPerDay: 2 })));
      const result = await getCityClimate(30.27, -97.74);

      expect(result.error).toBeUndefined();
      expect(result.tempMax).toBe(35);
      expect(result.tempMin).toBe(5);
      expect(result.tempMeanMax).toBe(35);
      expect(result.tempMeanMin).toBe(5);
      expect(result.annualPrecipMm).toBe(Math.round(7300 * 2 / 21));
      expect(typeof result.biome).toBe('string');
      expect(typeof result.label).toBe('string');
    });

    it('classifies tropical-rainforest biome', async () => {
      fetch.mockResolvedValueOnce(mockJson(fakeClimateData({ maxTemp: 32, minTemp: 22, precipPerDay: 8 })));
      const result = await getCityClimate(0, 0);
      expect(result.biome).toBe('tropical-rainforest');
    });

    it('classifies desert biome', async () => {
      fetch.mockResolvedValueOnce(mockJson(fakeClimateData({ maxTemp: 45, minTemp: 5, precipPerDay: 0.2 })));
      const result = await getCityClimate(0, 0);
      expect(result.biome).toBe('desert');
    });

    it('classifies tundra biome', async () => {
      fetch.mockResolvedValueOnce(mockJson(fakeClimateData({ maxTemp: 8, minTemp: -30, precipPerDay: 1 })));
      const result = await getCityClimate(0, 0);
      expect(result.biome).toBe('tundra');
    });

    it('returns error on non-2xx response', async () => {
      fetch.mockResolvedValueOnce(mockError(500));
      const result = await getCityClimate(0, 0);
      expect(result.error).toBe(true);
    });

    it('returns error on network failure', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await getCityClimate(0, 0);
      expect(result.error).toBe(true);
    });

    it('returns error when no data returned', async () => {
      fetch.mockResolvedValueOnce(mockJson({ daily: { temperature_2m_max: [], temperature_2m_min: [], precipitation_sum: [] } }));
      const result = await getCityClimate(0, 0);
      expect(result.error).toBe(true);
    });
  });

  describe('classifySpeciesClimateCompatibility', () => {
    const warmClimate = { tempMin: 5, tempMax: 40, tempMeanMax: 28, annualPrecipMm: 700, biome: 'temperate', label: 'Temperate' };
    const coldClimate = { tempMin: -30, tempMax: 15, tempMeanMax: 8, annualPrecipMm: 400, biome: 'tundra', label: 'Tundra' };
    const dryClimate = { tempMin: 5, tempMax: 45, tempMeanMax: 32, annualPrecipMm: 150, biome: 'desert', label: 'Desert' };

    it('returns unknown when no climate data', () => {
      const result = classifySpeciesClimateCompatibility({}, null);
      expect(result.climateCompatibility).toBe('unknown');
    });

    it('marks arctic species as incompatible in warm climate', () => {
      const result = classifySpeciesClimateCompatibility(
        { commonName: 'Arctic Fox', iconicTaxonName: 'Mammalia', taxonomy: {} },
        warmClimate
      );
      expect(result.climateCompatibility).toBe('incompatible');
    });

    it('marks arctic species as compatible in cold climate', () => {
      const result = classifySpeciesClimateCompatibility(
        { commonName: 'Arctic Fox', iconicTaxonName: 'Mammalia', taxonomy: {} },
        coldClimate
      );
      expect(result.climateCompatibility).toBe('compatible');
    });

    it('marks tropical plant as marginal in cold climate', () => {
      const result = classifySpeciesClimateCompatibility(
        { commonName: 'Banana', iconicTaxonName: 'Plantae', taxonomy: { family: 'Musaceae' } },
        coldClimate
      );
      expect(['marginal', 'incompatible']).toContain(result.climateCompatibility);
    });

    it('marks cactus as marginal in wet climate', () => {
      const result = classifySpeciesClimateCompatibility(
        { commonName: 'Saguaro Cactus', iconicTaxonName: 'Plantae', taxonomy: { family: 'Cactaceae' } },
        { ...warmClimate, annualPrecipMm: 1500 }
      );
      expect(result.climateCompatibility).toBe('marginal');
    });

    it('marks regular species as compatible by default', () => {
      const result = classifySpeciesClimateCompatibility(
        { commonName: 'Red Fox', iconicTaxonName: 'Mammalia', taxonomy: {} },
        warmClimate
      );
      expect(result.climateCompatibility).toBe('compatible');
    });
  });
});
