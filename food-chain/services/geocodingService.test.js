import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { geocodeCity, normalizePlace } from './geocodingService.js';

describe('GeocodingService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('geocodeCity', () => {
    it('returns normalized region for successful response (picks highest importance)', async () => {
      const mockResults = [
        {
          importance: 0.5,
          lat: '35.2828',
          lon: '-120.6596',
          address: {
            city: 'San Luis Obispo',
            state: 'California',
            country: 'United States',
            county: 'San Luis Obispo County',
          },
        },
        {
          importance: 0.9,
          lat: '37.7749',
          lon: '-122.4194',
          address: {
            city: 'San Francisco',
            state: 'California',
            country: 'United States',
            county: 'San Francisco County',
          },
        },
        {
          importance: 0.3,
          lat: '34.0522',
          lon: '-118.2437',
          address: {
            city: 'Los Angeles',
            state: 'California',
            country: 'United States',
            county: 'Los Angeles County',
          },
        },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
      });

      const result = await geocodeCity({ city: 'San Francisco' });

      expect(result.city).toBe('San Francisco');
      expect(result.state).toBe('California');
      expect(result.country).toBe('United States');
      expect(result.county).toBe('San Francisco County');
      expect(result.lat).toBe(37.7749);
      expect(result.lng).toBe(-122.4194);
    });

    it('returns { notFound: true } for empty array response', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await geocodeCity({ city: 'NonexistentCity12345' });
      expect(result).toEqual({ notFound: true });
    });

    it('returns { error: true, message } for non-2xx HTTP status', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await geocodeCity({ city: 'SomeCity' });
      expect(result.error).toBe(true);
      expect(result.message).toContain('503');
    });

    it('returns { error: true, message } for network error (fetch throws)', async () => {
      fetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await geocodeCity({ city: 'SomeCity' });
      expect(result.error).toBe(true);
      expect(result.message).toBe('Network failure');
    });

    it('sets User-Agent header on the request', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            importance: 0.8,
            lat: '51.5074',
            lon: '-0.1278',
            address: { city: 'London', country: 'United Kingdom' },
          },
        ],
      });

      await geocodeCity({ city: 'London' });

      expect(fetch).toHaveBeenCalledOnce();
      const [, options] = fetch.mock.calls[0];
      expect(options.headers['User-Agent']).toBe('ecosystem-builder/1.0');
    });

    it('includes state in the query when provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            importance: 0.8,
            lat: '35.2828',
            lon: '-120.6596',
            address: { city: 'San Luis Obispo', state: 'California', country: 'United States' },
          },
        ],
      });

      await geocodeCity({ city: 'San Luis Obispo', state: 'California' });

      const [url] = fetch.mock.calls[0];
      expect(url).toContain('California');
    });

    it('includes countrycodes param when country is provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            importance: 0.8,
            lat: '48.8566',
            lon: '2.3522',
            address: { city: 'Paris', country: 'France' },
          },
        ],
      });

      await geocodeCity({ city: 'Paris', country: 'France' });

      const [url] = fetch.mock.calls[0];
      expect(url).toContain('countrycodes=France');
    });
  });

  describe('normalizePlace', () => {
    it('extracts city from address.city', () => {
      const result = normalizePlace({
        lat: '10.0',
        lon: '20.0',
        address: { city: 'TestCity', state: 'TestState', country: 'TestCountry' },
      });
      expect(result.city).toBe('TestCity');
    });

    it('falls back to town when city is absent', () => {
      const result = normalizePlace({
        lat: '10.0',
        lon: '20.0',
        address: { town: 'SmallTown', country: 'TestCountry' },
      });
      expect(result.city).toBe('SmallTown');
    });

    it('falls back to village when city and town are absent', () => {
      const result = normalizePlace({
        lat: '10.0',
        lon: '20.0',
        address: { village: 'TinyVillage', country: 'TestCountry' },
      });
      expect(result.city).toBe('TinyVillage');
    });

    it('falls back to municipality when city/town/village are absent', () => {
      const result = normalizePlace({
        lat: '10.0',
        lon: '20.0',
        address: { municipality: 'BigMunicipality', country: 'TestCountry' },
      });
      expect(result.city).toBe('BigMunicipality');
    });

    it('extracts county from address.county', () => {
      const result = normalizePlace({
        lat: '10.0',
        lon: '20.0',
        address: { city: 'City', county: 'MyCounty', country: 'Country' },
      });
      expect(result.county).toBe('MyCounty');
    });

    it('falls back to state_district for county', () => {
      const result = normalizePlace({
        lat: '10.0',
        lon: '20.0',
        address: { city: 'City', state_district: 'District', country: 'Country' },
      });
      expect(result.county).toBe('District');
    });

    it('converts lat and lon to numbers', () => {
      const result = normalizePlace({
        lat: '35.2828',
        lon: '-120.6596',
        address: {},
      });
      expect(typeof result.lat).toBe('number');
      expect(typeof result.lng).toBe('number');
      expect(result.lat).toBe(35.2828);
      expect(result.lng).toBe(-120.6596);
    });

    it('returns null for missing fields', () => {
      const result = normalizePlace({ lat: '0', lon: '0', address: {} });
      expect(result.city).toBeNull();
      expect(result.state).toBeNull();
      expect(result.country).toBeNull();
      expect(result.county).toBeNull();
    });
  });
});
