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
