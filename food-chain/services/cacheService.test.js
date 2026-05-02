import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import CacheService, { TTL, cacheService } from './cacheService.js';

describe('CacheService', () => {
  let cache;

  beforeEach(() => {
    cache = new CacheService();
  });

  describe('TTL constants', () => {
    it('GEOCODE TTL is 1 hour (3600000 ms)', () => {
      expect(TTL.GEOCODE).toBe(3_600_000);
    });

    it('OBSERVED TTL is 30 minutes (1800000 ms)', () => {
      expect(TTL.OBSERVED).toBe(1_800_000);
    });

    it('NATIVITY TTL is 24 hours (86400000 ms)', () => {
      expect(TTL.NATIVITY).toBe(86_400_000);
    });

    it('ENRICHMENT TTL is 24 hours (86400000 ms)', () => {
      expect(TTL.ENRICHMENT).toBe(86_400_000);
    });

    it('ECOSYSTEM TTL is 15 minutes (900000 ms)', () => {
      expect(TTL.ECOSYSTEM).toBe(900_000);
    });
  });

  describe('get and set', () => {
    it('set then get returns the stored value', () => {
      cache.set('key1', { data: 'hello' }, 60_000);
      const result = cache.get('key1');
      expect(result).toEqual({ data: 'hello' });
    });

    it('get on missing key returns null', () => {
      const result = cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('stores and retrieves primitive values', () => {
      cache.set('num', 42, 60_000);
      expect(cache.get('num')).toBe(42);
    });

    it('stores and retrieves array values', () => {
      cache.set('arr', [1, 2, 3], 60_000);
      expect(cache.get('arr')).toEqual([1, 2, 3]);
    });
  });

  describe('TTL expiry', () => {
    it('get after TTL expires returns null', () => {
      vi.useFakeTimers();
      try {
        cache.set('expiring', 'value', 1_000);
        // Before expiry
        expect(cache.get('expiring')).toBe('value');
        // Advance time past TTL
        vi.advanceTimersByTime(1_001);
        expect(cache.get('expiring')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('get just before TTL expires still returns value', () => {
      vi.useFakeTimers();
      try {
        cache.set('almost', 'still-here', 1_000);
        vi.advanceTimersByTime(999);
        expect(cache.get('almost')).toBe('still-here');
      } finally {
        vi.useRealTimers();
      }
    });

    it('expired entry is removed from store on access', () => {
      vi.useFakeTimers();
      try {
        cache.set('gone', 'value', 500);
        vi.advanceTimersByTime(600);
        // First access returns null and removes entry
        expect(cache.get('gone')).toBeNull();
        // Second access also returns null
        expect(cache.get('gone')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('clear', () => {
    it('clear removes all entries', () => {
      cache.set('a', 1, 60_000);
      cache.set('b', 2, 60_000);
      cache.set('c', 3, 60_000);
      cache.clear();
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeNull();
      expect(cache.get('c')).toBeNull();
    });

    it('clear on empty cache does not throw', () => {
      expect(() => cache.clear()).not.toThrow();
    });
  });

  describe('default TTL', () => {
    it('uses GEOCODE TTL as default when no ttlMs provided', () => {
      vi.useFakeTimers();
      try {
        cache.set('default-ttl', 'value');
        // Just before GEOCODE TTL
        vi.advanceTimersByTime(TTL.GEOCODE - 1);
        expect(cache.get('default-ttl')).toBe('value');
        // After GEOCODE TTL
        vi.advanceTimersByTime(2);
        expect(cache.get('default-ttl')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('singleton export', () => {
    it('cacheService is an instance of CacheService', () => {
      expect(cacheService).toBeInstanceOf(CacheService);
    });
  });
});
