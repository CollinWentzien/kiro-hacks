import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getPlantNativity,
  getAnimalNativity,
  getNatureServeStatus,
  scoreNativeConfidence,
} from './nativityService.js';

describe('NativityService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getPlantNativity', () => {
    it('routes to POWO (fetch called with POWO URL)', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              accepted: true,
              nativeDistributions: ['United Kingdom', 'France'],
            },
          ],
        }),
      });

      await getPlantNativity({ scientificName: 'Quercus robur', country: 'United Kingdom' });

      expect(fetch).toHaveBeenCalledOnce();
      const [url] = fetch.mock.calls[0];
      expect(url).toContain('powo.science.kew.org');
    });

    it('returns native/high when country is in native distributions', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              accepted: true,
              nativeDistributions: ['United Kingdom', 'France', 'Germany'],
            },
          ],
        }),
      });

      const result = await getPlantNativity({ scientificName: 'Quercus robur', country: 'United Kingdom' });

      expect(result.nativeStatus).toBe('native');
      expect(result.confidence).toBe('high');
      expect(result.sources).toContain('POWO');
    });

    it('returns non-native/high when country is not in native distributions', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              accepted: true,
              nativeDistributions: ['Australia', 'New Zealand'],
            },
          ],
        }),
      });

      const result = await getPlantNativity({ scientificName: 'Eucalyptus globulus', country: 'United States' });

      expect(result.nativeStatus).toBe('non-native');
      expect(result.confidence).toBe('high');
    });

    it('returns unknown with sourceError on POWO API failure', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const result = await getPlantNativity({ scientificName: 'Quercus robur', country: 'UK' });

      expect(result.nativeStatus).toBe('unknown');
      expect(result.confidence).toBe('unknown');
      expect(result.sourceError).toBeTruthy();
      expect(result.sourceError).toContain('503');
    });

    it('returns unknown with sourceError on network error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await getPlantNativity({ scientificName: 'Quercus robur', country: 'UK' });

      expect(result.nativeStatus).toBe('unknown');
      expect(result.confidence).toBe('unknown');
      expect(result.sourceError).toBe('Network failure');
    });
  });

  describe('getAnimalNativity', () => {
    it('US animal routes to NatureServe', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ globalRank: 'G4' }],
        }),
      });

      await getAnimalNativity({ scientificName: 'Canis lupus', country: 'United States' });

      expect(fetch).toHaveBeenCalledOnce();
      const [url] = fetch.mock.calls[0];
      expect(url).toContain('natureserve.org');
    });

    it('Canadian animal routes to NatureServe', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ globalRank: 'G3' }],
        }),
      });

      await getAnimalNativity({ scientificName: 'Canis lupus', country: 'Canada' });

      expect(fetch).toHaveBeenCalledOnce();
      const [url] = fetch.mock.calls[0];
      expect(url).toContain('natureserve.org');
    });

    it('non-US/CA animal returns unknown without any fetch call', async () => {
      const result = await getAnimalNativity({ scientificName: 'Canis lupus', country: 'Germany' });

      expect(fetch).not.toHaveBeenCalled();
      expect(result.nativeStatus).toBe('unknown');
      expect(result.confidence).toBe('unknown');
    });

    it('handles "usa" (lowercase) as US', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ globalRank: 'G5' }] }),
      });

      await getAnimalNativity({ scientificName: 'Canis lupus', country: 'usa' });
      expect(fetch).toHaveBeenCalledOnce();
    });

    it('handles "ca" (lowercase) as Canada', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ globalRank: 'G5' }] }),
      });

      await getAnimalNativity({ scientificName: 'Canis lupus', country: 'ca' });
      expect(fetch).toHaveBeenCalledOnce();
    });
  });

  describe('getNatureServeStatus', () => {
    it('returns native/high for G1-G3 ranks', async () => {
      for (const rank of ['G1', 'G2', 'G3']) {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [{ globalRank: rank }] }),
        });

        const result = await getNatureServeStatus({ scientificName: 'Test species' });
        expect(result.nativeStatus).toBe('native');
        expect(result.confidence).toBe('high');
      }
    });

    it('returns native/medium for G4-G5 ranks', async () => {
      for (const rank of ['G4', 'G5']) {
        fetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [{ globalRank: rank }] }),
        });

        const result = await getNatureServeStatus({ scientificName: 'Test species' });
        expect(result.nativeStatus).toBe('native');
        expect(result.confidence).toBe('medium');
      }
    });

    it('returns non-native/high for GX rank', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [{ globalRank: 'GX' }] }),
      });

      const result = await getNatureServeStatus({ scientificName: 'Test species' });
      expect(result.nativeStatus).toBe('non-native');
      expect(result.confidence).toBe('high');
    });

    it('returns unknown with sourceError on API failure', async () => {
      fetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await getNatureServeStatus({ scientificName: 'Test species' });

      expect(result.nativeStatus).toBe('unknown');
      expect(result.confidence).toBe('unknown');
      expect(result.sourceError).toBeTruthy();
    });

    it('returns unknown with sourceError on network error', async () => {
      fetch.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await getNatureServeStatus({ scientificName: 'Test species' });

      expect(result.nativeStatus).toBe('unknown');
      expect(result.confidence).toBe('unknown');
      expect(result.sourceError).toBe('Connection timeout');
    });
  });

  describe('scoreNativeConfidence', () => {
    it('G1 → native/high', () => {
      expect(scoreNativeConfidence('G1')).toEqual({ nativeStatus: 'native', confidence: 'high' });
    });

    it('G2 → native/high', () => {
      expect(scoreNativeConfidence('G2')).toEqual({ nativeStatus: 'native', confidence: 'high' });
    });

    it('G3 → native/high', () => {
      expect(scoreNativeConfidence('G3')).toEqual({ nativeStatus: 'native', confidence: 'high' });
    });

    it('G4 → native/medium', () => {
      expect(scoreNativeConfidence('G4')).toEqual({ nativeStatus: 'native', confidence: 'medium' });
    });

    it('G5 → native/medium', () => {
      expect(scoreNativeConfidence('G5')).toEqual({ nativeStatus: 'native', confidence: 'medium' });
    });

    it('GX → non-native/high', () => {
      expect(scoreNativeConfidence('GX')).toEqual({ nativeStatus: 'non-native', confidence: 'high' });
    });

    it('GH → non-native/high', () => {
      expect(scoreNativeConfidence('GH')).toEqual({ nativeStatus: 'non-native', confidence: 'high' });
    });

    it('empty string → unknown/unknown', () => {
      expect(scoreNativeConfidence('')).toEqual({ nativeStatus: 'unknown', confidence: 'unknown' });
    });

    it('null → unknown/unknown', () => {
      expect(scoreNativeConfidence(null)).toEqual({ nativeStatus: 'unknown', confidence: 'unknown' });
    });
  });
});
