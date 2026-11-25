const SHARED_ENCODER = new TextEncoder();

export function utf8ByteLength(value: string): number {
  return SHARED_ENCODER.encode(value).byteLength;
}

export interface FixedWindowSlot {
  bucketId: number;
  expiresAtMs: number;
  retryAfterSec: number;
}

export function computeFixedWindow(
  windowSec: number,
  now = Date.now(),
): FixedWindowSlot {
  const windowMs = Math.max(1000, windowSec * 1000);
  const bucketId = Math.floor(now / windowMs);
  const expiresAtMs = (bucketId + 1) * windowMs;
  const retryAfterSec = Math.max(1, Math.ceil((expiresAtMs - now) / 1000));
  return { bucketId, expiresAtMs, retryAfterSec };
}

/**
 * Throttles repetitive infrastructure warnings to at most once per minute
 * per helper instance to avoid noisy Cloud Run log spikes on transient errors.
 */
export function createRateLimitedWarner(
  tag: string,
  cooldownMs = 60_000,
): (op: string, detail: string) => void {
  let lastWarnAt = 0;
  return (op: string, detail: string) => {
    const now = Date.now();
    if (now - lastWarnAt < cooldownMs) return;
    lastWarnAt = now;
    console.warn(`[ClearDay][${tag}] ${op} failed: ${detail}`);
  };
}
