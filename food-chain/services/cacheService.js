// In-memory TTL cache
export const TTL = {
  GEOCODE: 3_600_000,      // 1 hour
  OBSERVED: 1_800_000,     // 30 min
  NATIVITY: 86_400_000,    // 24 hours
  ENRICHMENT: 86_400_000,  // 24 hours
  ECOSYSTEM: 900_000,      // 15 min
};

class CacheService {
  #store = new Map();

  /**
   * Get a cached value by key.
   * Returns null on miss or if the entry has expired.
   */
  get(key) {
    const entry = this.#store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.#store.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Store a value with a TTL.
   * @param {string} key
   * @param {*} value
   * @param {number} ttlMs - time to live in milliseconds
   */
  set(key, value, ttlMs = TTL.GEOCODE) {
    this.#store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Clear all cache entries.
   */
  clear() {
    this.#store.clear();
  }
}

export const cacheService = new CacheService();
export default CacheService;
