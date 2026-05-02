import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getTaxonMetadata, getPhoto, getCommonName, buildTaxonomy } from './enrichmentService.js';

// Helper to make a mock fetch response
const mockJson = (data) => ({ ok: true, json: async () => data });
const mockError = (status = 500) => ({ ok: false, status });

describe('EnrichmentService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getTaxonMetadata', () => {
    it('iNaturalist hit: returns full metadata with sources: [iNaturalist]', async () => {
      // First call: taxa search
      fetch.mockResolvedValueOnce(mockJson({
        results: [{
          id: 12345,
          name: 'Quercus robur',
          preferred_common_name: 'English Oak',
          default_photo: { medium_url: 'https://example.com/oak.jpg' },
          observations_count: 50000,
          iconic_taxon_name: 'Plantae',
        }],
      }));

      // Second call: ancestors fetch (taxa/12345)
      fetch.mockResolvedValueOnce(mockJson({
        results: [{
          ancestors: [
            { rank: 'kingdom', name: 'Plantae' },
            { rank: 'phylum', name: 'Tracheophyta' },
            { rank: 'class', name: 'Magnoliopsida' },
            { rank: 'order', name: 'Fagales' },
            { rank: 'family', name: 'Fagaceae' },
            { rank: 'genus', name: 'Quercus' },
          ],
        }],
      }));

      const result = await getTaxonMetadata('Quercus robur');

      expect(result.sources).toEqual(['iNaturalist']);
      expect(result.commonName).toBe('English Oak');
      expect(result.photoUrl).toBe('https://example.com/oak.jpg');
      expect(result.observationSummary).toContain('50,000');
      expect(result.sourceLinks[0].source).toBe('iNaturalist');
      expect(result.sourceLinks[0].url).toContain('12345');
      expect(result.taxonomy.kingdom).toBe('Plantae');
      expect(result.taxonomy.family).toBe('Fagaceae');
      expect(result.taxonomy.genus).toBe('Quercus');
    });

    it('iNaturalist miss (empty results): falls back to GBIF', async () => {
      // iNaturalist returns empty
      fetch.mockResolvedValueOnce(mockJson({ results: [] }));

      // GBIF returns a match
      fetch.mockResolvedValueOnce(mockJson({
        usageKey: 99999,
        canonicalName: 'Quercus robur',
        vernacularName: 'English Oak',
        kingdom: 'Plantae',
        matchType: 'EXACT',
      }));

      const result = await getTaxonMetadata('Quercus robur');

      expect(result.sources).toEqual(['GBIF']);
      expect(result.commonName).toBe('English Oak');
      expect(result.sourceLinks[0].source).toBe('GBIF');
    });

    it('GBIF fallback hit: returns partial metadata with sources: [GBIF]', async () => {
      fetch.mockResolvedValueOnce(mockJson({ results: [] }));

      fetch.mockResolvedValueOnce(mockJson({
        usageKey: 77777,
        canonicalName: 'Canis lupus',
        kingdom: 'Animalia',
        matchType: 'EXACT',
      }));

      const result = await getTaxonMetadata('Canis lupus');

      expect(result.sources).toEqual(['GBIF']);
      expect(result.photoUrl).toBeNull();
      expect(result.observationSummary).toBeNull();
      expect(result.commonName).toBeNull(); // no vernacularName
    });

    it('both miss: returns { notFound: true }', async () => {
      fetch.mockResolvedValueOnce(mockJson({ results: [] }));
      fetch.mockResolvedValueOnce(mockJson({ matchType: 'NONE' }));

      const result = await getTaxonMetadata('Nonexistent species xyz');
      expect(result).toEqual({ notFound: true });
    });

    it('both error: returns { error: true }', async () => {
      fetch.mockResolvedValueOnce(mockError(503));
      fetch.mockResolvedValueOnce(mockError(500));

      const result = await getTaxonMetadata('Some species');
      expect(result.error).toBe(true);
      expect(result.message).toBeTruthy();
    });

    it('iNaturalist network error, GBIF succeeds: returns GBIF result', async () => {
      fetch.mockRejectedValueOnce(new Error('iNat network error'));

      fetch.mockResolvedValueOnce(mockJson({
        usageKey: 55555,
        canonicalName: 'Felis catus',
        kingdom: 'Animalia',
        matchType: 'EXACT',
      }));

      const result = await getTaxonMetadata('Felis catus');
      expect(result.sources).toEqual(['GBIF']);
    });

    it('sources array reflects which APIs contributed', async () => {
      fetch.mockResolvedValueOnce(mockJson({
        results: [{
          id: 11111,
          name: 'Test species',
          preferred_common_name: 'Test',
          default_photo: null,
          observations_count: 100,
          iconic_taxon_name: 'Animalia',
        }],
      }));

      // ancestors call returns empty
      fetch.mockResolvedValueOnce(mockJson({ results: [{ ancestors: [] }] }));

      const result = await getTaxonMetadata('Test species');
      expect(result.sources).toContain('iNaturalist');
      expect(result.sources).not.toContain('GBIF');
    });
  });

  describe('getPhoto', () => {
    it('extracts medium photo URL from default_photo', () => {
      const taxon = { default_photo: { medium_url: 'https://example.com/photo.jpg' } };
      expect(getPhoto(taxon)).toBe('https://example.com/photo.jpg');
    });

    it('returns null when default_photo is null', () => {
      expect(getPhoto({ default_photo: null })).toBeNull();
    });

    it('returns null when default_photo is absent', () => {
      expect(getPhoto({})).toBeNull();
    });

    it('returns null for null input', () => {
      expect(getPhoto(null)).toBeNull();
    });
  });

  describe('getCommonName', () => {
    it('extracts preferred_common_name', () => {
      expect(getCommonName({ preferred_common_name: 'English Oak' })).toBe('English Oak');
    });

    it('returns null when preferred_common_name is absent', () => {
      expect(getCommonName({})).toBeNull();
    });

    it('returns null for null input', () => {
      expect(getCommonName(null)).toBeNull();
    });
  });

  describe('buildTaxonomy', () => {
    it('builds taxonomy from ancestors array', () => {
      const ancestors = [
        { rank: 'kingdom', name: 'Plantae' },
        { rank: 'family', name: 'Fagaceae' },
        { rank: 'genus', name: 'Quercus' },
      ];
      const result = buildTaxonomy({}, ancestors);
      expect(result.kingdom).toBe('Plantae');
      expect(result.family).toBe('Fagaceae');
      expect(result.genus).toBe('Quercus');
      expect(result.phylum).toBeNull();
    });

    it('falls back to iconic_taxon_name for class when ancestors missing', () => {
      const result = buildTaxonomy({ iconic_taxon_name: 'Aves' }, []);
      expect(result.class).toBe('Aves');
    });

    it('falls back to first word of name for genus when ancestors missing', () => {
      const result = buildTaxonomy({ name: 'Corvus brachyrhynchos' }, []);
      expect(result.genus).toBe('Corvus');
    });
  });
});
