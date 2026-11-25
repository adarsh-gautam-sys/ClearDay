export type StoreBackend = "redis-rest" | "firestore" | "memory-dev";

export interface WindowCheckResult {
  count: number;
  retryAfterSec: number;
}

/**
 * Shared key/value + rate-limit store interface enabling multi-instance
 * horizontal scaling on Cloud Run (Redis REST or Cloud Firestore) with a
 * byte-bounded memory fallback for local development and tests.
 */
export interface DistributedStore {
  readonly backend: StoreBackend;
  getJson<T>(key: string): Promise<T | null>;
  setJson<T>(key: string, value: T, ttlSec: number): Promise<void>;
  incrementWindow(
    key: string,
    windowSec: number,
    now?: number,
  ): Promise<WindowCheckResult>;
  clear?(): Promise<void>;
}

export const MAX_CACHE_ENTRY_BYTES = 65_536;
