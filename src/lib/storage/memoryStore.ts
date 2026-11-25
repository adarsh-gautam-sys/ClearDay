import {
  type DistributedStore,
  MAX_CACHE_ENTRY_BYTES,
  type WindowCheckResult,
} from "./types";

interface MemoryEntry {
  json: string;
  bytes: number;
  expiresAt: number;
}

interface CounterBucket {
  count: number;
  expiresAt: number;
}

/**
 * Byte-bounded LRU/TTL memory fallback strictly for local dev and unit tests.
 * Caps both total entries and cumulative UTF-8 payload bytes to prevent heap growth.
 */
export class ByteBoundedMemoryStore implements DistributedStore {
  readonly backend = "memory-dev" as const;

  private readonly cache = new Map<string, MemoryEntry>();
  private readonly windows = new Map<string, CounterBucket>();
  private totalBytes = 0;

  constructor(
    private readonly maxEntries = 120,
    private readonly maxBytes = 2 * 1024 * 1024,
    private readonly maxRateKeys = 2000,
  ) {}

  async getJson<T>(key: string, now = Date.now()): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (now >= entry.expiresAt) {
      this.deleteEntry(key, entry);
      return null;
    }

    // Refresh LRU recency order
    this.cache.delete(key);
    this.cache.set(key, entry);

    try {
      return JSON.parse(entry.json) as T;
    } catch {
      this.deleteEntry(key, entry);
      return null;
    }
  }

  async setJson<T>(
    key: string,
    value: T,
    ttlSec: number,
    now = Date.now(),
  ): Promise<void> {
    const json = JSON.stringify(value);
    const bytes = new TextEncoder().encode(json).byteLength;

    if (bytes > MAX_CACHE_ENTRY_BYTES || bytes > this.maxBytes || ttlSec <= 0) {
      return;
    }

    const existing = this.cache.get(key);
    if (existing) {
      this.deleteEntry(key, existing);
    }

    this.pruneExpiredCache(now);

    while (
      this.cache.size >= this.maxEntries ||
      this.totalBytes + bytes > this.maxBytes
    ) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = this.cache.get(oldestKey);
      if (oldest) {
        this.deleteEntry(oldestKey, oldest);
      }
    }

    this.cache.set(key, {
      json,
      bytes,
      expiresAt: now + ttlSec * 1000,
    });
    this.totalBytes += bytes;
  }

  async incrementWindow(
    key: string,
    windowSec: number,
    now = Date.now(),
  ): Promise<WindowCheckResult> {
    const windowMs = Math.max(1000, windowSec * 1000);
    const bucketId = Math.floor(now / windowMs);
    const bucketKey = `${key}:${bucketId}`;
    const expiresAt = (bucketId + 1) * windowMs;

    const current = this.windows.get(bucketKey);
    const nextCount = current && now < current.expiresAt ? current.count + 1 : 1;
    this.windows.set(bucketKey, { count: nextCount, expiresAt });

    if (this.windows.size > this.maxRateKeys) {
      this.pruneExpiredWindows(now);
    }

    return {
      count: nextCount,
      retryAfterSec: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
    };
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.windows.clear();
    this.totalBytes = 0;
  }

  currentByteSize(): number {
    return this.totalBytes;
  }

  entryCount(): number {
    return this.cache.size;
  }

  private deleteEntry(key: string, entry: MemoryEntry): void {
    this.cache.delete(key);
    this.totalBytes = Math.max(0, this.totalBytes - entry.bytes);
  }

  private pruneExpiredCache(now: number): void {
    for (const [k, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.deleteEntry(k, entry);
      }
    }
  }

  private pruneExpiredWindows(now: number): void {
    for (const [k, bucket] of this.windows.entries()) {
      if (now >= bucket.expiresAt) {
        this.windows.delete(k);
      }
    }
  }
}
