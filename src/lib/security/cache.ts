interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Bounded in-memory TTL cache for server route handlers.
 * Evicts expired entries first, then the oldest entry when at capacity.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly maxEntries = 200) {}

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (now >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number, now = Date.now()): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    if (this.store.size >= this.maxEntries) {
      this.pruneExpired(now);
    }

    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, { value, expiresAt: now + ttlMs });
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  private pruneExpired(now: number): void {
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
