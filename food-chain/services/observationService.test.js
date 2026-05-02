import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getGbifObservedSpecies,
  getINatObservedSpecies,
  mergeObservedSpecies,
} from './observationService.js';

const mockJson = (data) => ({ ok: true, json: async () => data });
const mockError = (status) => ({ ok: false, status });

describe('ObservationService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getGbifObservedSpecies', () => {
    it('returns normalized species array on success', async () => {
      fetch.mockResolvedValueOnce(mockJson({
        results: [
          { species: 'Quercus robur', kingdom: 'Plantae' },
          { species: 'Canis lupus', kingdom: 'Animalia' },
        ],
      }));

      const result = await getGbifObservedSpecies({ lat: 51.5, lng: -0.1 });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        scientificName: 'Quercus robur',
        category: 'plant',
        observedNearby: true,
        sources: ['GBIF'],
      });
    });

    it('uses bounding box params (not radius)', async () => {
      fetch.mockResolvedValueOnce(mockJson({ results: [] }));

      await getGbifObservedSpecies({ lat: 51.5, lng: -0.1, radiusKm: 25 });

      const [url] = fetch.mock.calls[0];
      expect(url).toContain('decimalLatitude=');
      expect(url).toContain('decimalLongitude=');
      expect(url).not.toContain('radius=');
    });

    it('returns { error: true } on non-2xx response', async () => {
      fetch.mockResolvedValueOnce(mockError(500));
      const result = await getGbifObservedSpecies({ lat: 51.5, lng: -0.1 });
      expect(result.error).toBe(true);
      expect(result.message).toContain('500');
    });

    it('returns { error: true } on network error', async () => {
      fetch.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await getGbifObservedSpecies({ lat: 51.5, lng: -0.1 });
      expect(result.error).toBe(true);
    });

    it('normalizes Plantae to plant category', async () => {
      fetch.mockResolvedValueOnce(mockJson({
        results: [{ species: 'Rosa canina', kingdom: 'Plantae' }],
      }));
      const result = await getGbifObservedSpecies({ lat: 51.5, lng: -0.1 });
      expect(result[0].category).toBe('plant');
    });

    it('normalizes non-Plantae to animal category', async () => {
      fetch.mockResolvedValueOnce(mockJson({
        results: [{ species: 'Homo sapiens', kingdom: 'Animalia' }],
      }));
      const result = await getGbifObservedSpecies({ lat: 51.5, lng: -0.1 });
      expect(result[0].category).toBe('animal');
    });
  });

  describe('getINatObservedSpecies', () => {
    it('returns normalized species array from species_counts endpoint', async () => {
      fetch.mockResolvedValueOnce(mockJson({
        results: [
          {
            count: 500,
            taxon: {
              id: 1,
              name: 'Quercus robur',
              iconic_taxon_name: 'Plantae',
              preferred_common_name: 'English Oak',
              default_photo: { medium_url: 'https://example.com/oak.jpg' },
              observations_count: 50000,
            },
          },
          {
            count: 200,
            taxon: {
              id: 2,
              name: 'Canis lupus',
              iconic_taxon_name: 'Mammalia',
              preferred_common_name: 'Gray Wolf',
              default_photo: null,
              observations_count: 10000,
            },
          },
        ],
      }));

      const result = await getINatObservedSpecies({ lat: 51.5, lng: -0.1 });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        scientificName: 'Quercus robur',
        commonName: 'English Oak',
        category: 'plant',
        observedNearby: true,
        photoUrl: 'https://example.com/oak.jpg',
        sources: ['iNaturalist'],
      });
      expect(result[1].photoUrl).toBeNull();
    });

    it('uses species_counts endpoint URL', async () => {
      fetch.mockResolvedValueOnce(mockJson({ results: [] }));
      await getINatObservedSpecies({ lat: 51.5, lng: -0.1, radiusKm: 25 });
      const [url] = fetch.mock.calls[0];
      expect(url).toContain('species_counts');
      expect(url).toContain('radius=25');
    });

    it('returns { error: true } on non-2xx response', async () => {
      fetch.mockResolvedValueOnce(mockError(429));
      const result = await getINatObservedSpecies({ lat: 51.5, lng: -0.1 });
      expect(result.error).toBe(true);
    });

    it('returns { error: true } on network error', async () => {
      fetch.mockRejectedValueOnce(new Error('Timeout'));
      const result = await getINatObservedSpecies({ lat: 51.5, lng: -0.1 });
      expect(result.error).toBe(true);
    });

    it('normalizes Plantae to plant category', async () => {
      fetch.mockResolvedValueOnce(mockJson({
        results: [{ count: 1, taxon: { id: 1, name: 'Ficus carica', iconic_taxon_name: 'Plantae', default_photo: null } }],
      }));
      const result = await getINatObservedSpecies({ lat: 51.5, lng: -0.1 });
      expect(result[0].category).toBe('plant');
    });

    it('normalizes non-Plantae to animal category', async () => {
      fetch.mockResolvedValueOnce(mockJson({
        results: [{ count: 1, taxon: { id: 2, name: 'Felis catus', iconic_taxon_name: 'Mammalia', default_photo: null } }],
      }));
      const result = await getINatObservedSpecies({ lat: 51.5, lng: -0.1 });
      expect(result[0].category).toBe('animal');
    });
  });

  describe('mergeObservedSpecies', () => {
    it('iNaturalist takes priority over GBIF for duplicate species', () => {
      const inat = [
        { scientificName: 'Quercus robur', commonName: 'English Oak', category: 'plant', observedNearby: true, observationCount: 500, photoUrl: 'https://photo.jpg', sources: ['iNaturalist'] },
      ];
      const gbif = [
        { scientificName: 'Quercus robur', commonName: null, category: 'plant', observedNearby: true, observationCount: 1, photoUrl: null, sources: ['GBIF'] },
      ];

      const result = mergeObservedSpecies(gbif, inat);
      expect(result.species).toHaveLength(1);
      expect(result.species[0].commonName).toBe('English Oak');
      expect(result.species[0].photoUrl).toBe('https://photo.jpg');
      expect(result.species[0].sources).toContain('GBIF');
      expect(result.species[0].sources).toContain('iNaturalist');
    });

    it('deduplication is case-insensitive', () => {
      const inat = [{ scientificName: 'Quercus robur', category: 'plant', observedNearby: true, observationCount: 2, sources: ['iNaturalist'] }];
      const gbif = [{ scientificName: 'quercus robur', category: 'plant', observedNearby: true, observationCount: 1, sources: ['GBIF'] }];
      const result = mergeObservedSpecies(gbif, inat);
      expect(result.species).toHaveLength(1);
    });

    it('GBIF-only species are included when not in iNaturalist', () => {
      const inat = [{ scientificName: 'Canis lupus', category: 'animal', observedNearby: true, observationCount: 1, sources: ['iNaturalist'] }];
      const gbif = [{ scientificName: 'Quercus robur', category: 'plant', observedNearby: true, observationCount: 1, sources: ['GBIF'] }];
      const result = mergeObservedSpecies(gbif, inat);
      expect(result.species).toHaveLength(2);
    });

    it('one source fails: returns partialFailure: true', () => {
      const gbif = { error: true, message: 'GBIF down' };
      const inat = [{ scientificName: 'Canis lupus', category: 'animal', observedNearby: true, observationCount: 1, sources: ['iNaturalist'] }];
      const result = mergeObservedSpecies(gbif, inat);
      expect(result.partialFailure).toBe(true);
      expect(result.species).toHaveLength(1);
    });

    it('both sources fail: returns { error: true }', () => {
      const result = mergeObservedSpecies({ error: true }, { error: true });
      expect(result.error).toBe(true);
      expect(result.message).toBe('Both observation sources failed');
    });
  });
});
