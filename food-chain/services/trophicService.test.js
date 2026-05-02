import { describe, it, expect } from 'vitest';
import { assignTrophicLevel, assignBulkTrophicLevels } from './trophicService.js';

const plant = (overrides = {}) => ({
  category: 'plant', iconicTaxonName: 'Plantae', taxonomy: { kingdom: 'Plantae' },
  commonName: 'Test Plant', interactions: { eats: [], eatenBy: [], pollinates: [], pollinatedBy: [] },
  ...overrides,
});

const animal = (overrides = {}) => ({
  category: 'animal', iconicTaxonName: 'Mammalia', taxonomy: { kingdom: 'Animalia' },
  commonName: 'Test Animal', interactions: { eats: [], eatenBy: [], pollinates: [], pollinatedBy: [] },
  ...overrides,
});

describe('TrophicService', () => {
  describe('assignTrophicLevel', () => {
    it('assigns level 1 to plants', () => {
      const result = assignTrophicLevel(plant());
      expect(result.trophicLevel).toBe(1);
      expect(result.trophicLabel).toBe('producer');
    });

    it('assigns level 0 to fungi', () => {
      const result = assignTrophicLevel(animal({ iconicTaxonName: 'Fungi', taxonomy: { kingdom: 'Fungi' } }));
      expect(result.trophicLevel).toBe(0);
      expect(result.trophicLabel).toBe('decomposer');
    });

    it('assigns level 0 to species with "mushroom" in name', () => {
      const result = assignTrophicLevel(animal({ commonName: 'Oyster Mushroom', iconicTaxonName: 'Fungi' }));
      expect(result.trophicLevel).toBe(0);
    });

    it('assigns level 2 to herbivore (eats plants)', () => {
      const result = assignTrophicLevel(animal({
        interactions: { eats: ['grass', 'Quercus robur'], eatenBy: ['Canis lupus'], pollinates: [], pollinatedBy: [] },
      }));
      expect(result.trophicLevel).toBe(2);
      expect(result.trophicLabel).toBe('primary consumer');
    });

    it('assigns level 3 to secondary consumer (eats animals, has predators)', () => {
      const result = assignTrophicLevel(animal({
        interactions: { eats: ['Mus musculus', 'Rattus norvegicus'], eatenBy: ['Aquila chrysaetos'], pollinates: [], pollinatedBy: [] },
      }));
      expect(result.trophicLevel).toBe(3);
      expect(result.trophicLabel).toBe('secondary consumer');
    });

    it('assigns level 4 to apex predator (eats animals, no predators)', () => {
      const result = assignTrophicLevel(animal({
        interactions: { eats: ['Mus musculus', 'Lepus americanus', 'Ondatra zibethicus'], eatenBy: [], pollinates: [], pollinatedBy: [] },
      }));
      expect(result.trophicLevel).toBe(4);
      expect(result.trophicLabel).toBe('apex predator');
    });

    it('assigns level 2 to animal with no interaction data', () => {
      const result = assignTrophicLevel(animal({ interactions: { eats: [], eatenBy: [], pollinates: [], pollinatedBy: [] } }));
      expect(result.trophicLevel).toBe(2);
    });

    it('assigns level 3 to omnivore with predators', () => {
      const result = assignTrophicLevel(animal({
        interactions: { eats: ['grass', 'Mus musculus'], eatenBy: ['Canis lupus'], pollinates: [], pollinatedBy: [] },
      }));
      expect(result.trophicLevel).toBe(3);
    });

    it('assigns level 4 to omnivore with no predators', () => {
      const result = assignTrophicLevel(animal({
        interactions: { eats: ['berry', 'Mus musculus'], eatenBy: [], pollinates: [], pollinatedBy: [] },
      }));
      expect(result.trophicLevel).toBe(4);
    });
  });

  describe('assignBulkTrophicLevels', () => {
    it('adds trophicLevel, trophicLabel, trophicNote to each species', () => {
      const species = [plant(), animal()];
      const result = assignBulkTrophicLevels(species);
      expect(result).toHaveLength(2);
      expect(result[0].trophicLevel).toBe(1);
      expect(result[1].trophicLevel).toBe(2);
      result.forEach(s => {
        expect(typeof s.trophicLevel).toBe('number');
        expect(typeof s.trophicLabel).toBe('string');
        expect(typeof s.trophicNote).toBe('string');
      });
    });

    it('does not mutate original species objects', () => {
      const original = plant();
      const result = assignBulkTrophicLevels([original]);
      expect(original.trophicLevel).toBeUndefined();
      expect(result[0].trophicLevel).toBe(1);
    });
  });
});
