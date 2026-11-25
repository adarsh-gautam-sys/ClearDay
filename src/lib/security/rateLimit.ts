import { getDistributedStore } from "../storage/distributedStore";
import type { DistributedStore } from "../storage/types";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

const SAFE_IP_PATTERN = /^[0-9a-fA-F:.]{2,64}$/;

/**
 * Distributed fixed-window rate limiter backed by Redis REST, Cloud Firestore,
 * or byte-bounded memory store in local development.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSec: number,
  store: DistributedStore = getDistributedStore(),
): Promise<RateLimitResult> {
  const result = await store.incrementWindow(key, windowSec);
  const allowed = result.count <= maxRequests;

  return {
    allowed,
    remaining: Math.max(0, maxRequests - result.count),
    retryAfterSec: allowed ? 0 : result.retryAfterSec,
  };
}

/**
 * Extracts client IP safely behind Google Cloud Run / GFE proxies.
 * Reads the rightmost valid IP in X-Forwarded-For (appended by the trusted proxy)
 * to prevent client-header spoofing.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .filter((part) => SAFE_IP_PATTERN.test(part));
    const rightmost = parts[parts.length - 1];
    if (rightmost) return rightmost;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && SAFE_IP_PATTERN.test(realIp)) {
    return realIp;
  }

  return "127.0.0.1";
}
