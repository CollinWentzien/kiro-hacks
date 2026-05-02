import { describe, it, expect } from 'vitest';
import { mergeSpeciesRecords, buildFinalSpeciesRecord } from './mergeService.js';

describe('MergeService', () => {
  describe('buildFinalSpeciesRecord', () => {
    const baseObserved = {
      scientificName: 'Quercus robur',
      category: 'plant',
      observedNearby: true,
      observationCount: 1,
      sources: ['GBIF'],
    };

    it('nativity present: nativeStatus and confidence attached', () => {
      const nativity = { nativeStatus: 'native', confidence: 'high', sources: ['POWO'] };
      const result = buildFinalSpeciesRecord(baseObserved, nativity, undefined);

      expect(result.nativeStatus).toBe('native');
      expect(result.confidence).toBe('high');
    });

    it('enrichment present: commonName and photoUrl attached', () => {
      const enrichment = {
        commonName: 'English Oak',
        photoUrl: 'https://example.com/oak.jpg',
        sources: ['iNaturalist'],
      };
      const result = buildFinalSpeciesRecord(baseObserved, undefined, enrichment);

      expect(result.commonName).toBe('English Oak');
      expect(result.photoUrl).toBe('https://example.com/oak.jpg');
    });

    it('nativity absent: nativeStatus=unknown, confidence=unknown', () => {
      const result = buildFinalSpeciesRecord(baseObserved, undefined, undefined);

      expect(result.nativeStatus).toBe('unknown');
      expect(result.confidence).toBe('unknown');
    });

    it('enrichment absent: commonName=null, photoUrl=null', () => {
      const result = buildFinalSpeciesRecord(baseObserved, undefined, undefined);

      expect(result.commonName).toBeNull();
      expect(result.photoUrl).toBeNull();
    });

    it('sources is union of all contributing API names', () => {
      const nativity = { nativeStatus: 'native', confidence: 'high', sources: ['POWO'] };
      const enrichment = { commonName: 'Oak', photoUrl: null, sources: ['iNaturalist'] };
      const result = buildFinalSpeciesRecord(baseObserved, nativity, enrichment);

      expect(result.sources).toContain('GBIF');
      expect(result.sources).toContain('POWO');
      expect(result.sources).toContain('iNaturalist');
    });

    it('sources does not contain duplicates', () => {
      const observed = { ...baseObserved, sources: ['GBIF', 'iNaturalist'] };
      const nativity = { nativeStatus: 'native', confidence: 'high', sources: ['GBIF'] };
      const result = buildFinalSpeciesRecord(observed, nativity, undefined);

      const gbifCount = result.sources.filter(s => s === 'GBIF').length;
      expect(gbifCount).toBe(1);
    });

    it('preserves scientificName from observed record', () => {
      const result = buildFinalSpeciesRecord(baseObserved, undefined, undefined);
      expect(result.scientificName).toBe('Quercus robur');
    });

    it('preserves category from observed record', () => {
      const result = buildFinalSpeciesRecord(baseObserved, undefined, undefined);
      expect(result.category).toBe('plant');
    });

    it('preserves observedNearby from observed record', () => {
      const result = buildFinalSpeciesRecord(baseObserved, undefined, undefined);
      expect(result.observedNearby).toBe(true);
    });

    it('defaults observedNearby to true when absent', () => {
      const observed = { scientificName: 'Test', category: 'animal', sources: [] };
      const result = buildFinalSpeciesRecord(observed, undefined, undefined);
      expect(result.observedNearby).toBe(true);
    });
  });

  describe('mergeSpeciesRecords', () => {
    it('merge key is case-insensitive scientific name', () => {
      const observedList = [
        { scientificName: 'Quercus Robur', category: 'plant', observedNearby: true, sources: ['GBIF'] },
      ];
      const nativityMap = new Map([
        ['quercus robur', { nativeStatus: 'native', confidence: 'high', sources: ['POWO'] }],
      ]);
      const enrichmentMap = new Map();

      const results = mergeSpeciesRecords(observedList, nativityMap, enrichmentMap);

      expect(results[0].nativeStatus).toBe('native');
    });

    it('handles leading/trailing whitespace in scientific name', () => {
      const observedList = [
        { scientificName: '  Canis lupus  ', category: 'animal', observedNearby: true, sources: ['GBIF'] },
      ];
      const nativityMap = new Map([
        ['canis lupus', { nativeStatus: 'native', confidence: 'medium', sources: ['NatureServe'] }],
      ]);
      const enrichmentMap = new Map();

      const results = mergeSpeciesRecords(observedList, nativityMap, enrichmentMap);

      expect(results[0].nativeStatus).toBe('native');
    });

    it('returns one record per observed species', () => {
      const observedList = [
        { scientificName: 'Quercus robur', category: 'plant', observedNearby: true, sources: ['GBIF'] },
        { scientificName: 'Canis lupus', category: 'animal', observedNearby: true, sources: ['iNaturalist'] },
      ];
      const nativityMap = new Map();
      const enrichmentMap = new Map();

      const results = mergeSpeciesRecords(observedList, nativityMap, enrichmentMap);

      expect(results).toHaveLength(2);
    });

    it('attaches enrichment data when present in enrichmentMap', () => {
      const observedList = [
        { scientificName: 'Quercus robur', category: 'plant', observedNearby: true, sources: ['GBIF'] },
      ];
      const nativityMap = new Map();
      const enrichmentMap = new Map([
        ['quercus robur', { commonName: 'English Oak', photoUrl: 'https://example.com/oak.jpg', sources: ['iNaturalist'] }],
      ]);

      const results = mergeSpeciesRecords(observedList, nativityMap, enrichmentMap);

      expect(results[0].commonName).toBe('English Oak');
      expect(results[0].photoUrl).toBe('https://example.com/oak.jpg');
    });

    it('both-source observation merges sources array', () => {
      const observedList = [
        { scientificName: 'Quercus robur', category: 'plant', observedNearby: true, sources: ['GBIF', 'iNaturalist'] },
      ];
      const nativityMap = new Map([
        ['quercus robur', { nativeStatus: 'native', confidence: 'high', sources: ['POWO'] }],
      ]);
      const enrichmentMap = new Map();

      const results = mergeSpeciesRecords(observedList, nativityMap, enrichmentMap);

      expect(results[0].sources).toContain('GBIF');
      expect(results[0].sources).toContain('iNaturalist');
      expect(results[0].sources).toContain('POWO');
    });

    it('missing nativity defaults to unknown', () => {
      const observedList = [
        { scientificName: 'Unknown species', category: 'animal', observedNearby: true, sources: ['GBIF'] },
      ];
      const results = mergeSpeciesRecords(observedList, new Map(), new Map());

      expect(results[0].nativeStatus).toBe('unknown');
      expect(results[0].confidence).toBe('unknown');
    });

    it('missing enrichment nulls commonName and photoUrl', () => {
      const observedList = [
        { scientificName: 'Unknown species', category: 'animal', observedNearby: true, sources: ['GBIF'] },
      ];
      const results = mergeSpeciesRecords(observedList, new Map(), new Map());

      expect(results[0].commonName).toBeNull();
      expect(results[0].photoUrl).toBeNull();
    });
  });
});
