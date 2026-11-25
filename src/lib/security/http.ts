import { NextResponse } from "next/server";
import type { z } from "zod";
import { getDistributedStore } from "../storage/distributedStore";
import type { DistributedStore } from "../storage/types";
import { utf8ByteLength } from "../storage/utils";
import { checkRateLimit, getClientIp } from "./rateLimit";

export const DEFAULT_MAX_JSON_BYTES = 32_768;

export type BoundedJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; status: 400 | 413 | 415; error: string };

const SHARED_DECODER = new TextDecoder();

/**
 * Streams and parses a JSON request body while enforcing Content-Type and a strict
 * cumulative UTF-8 byte ceiling before full allocation (guards against chunked floods).
 */
export async function readBoundedJson(
  request: Request,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<BoundedJsonResult> {
  const contentType = request.headers.get("content-type")?.trim().toLowerCase();
  if (contentType && !contentType.startsWith("application/json")) {
    return {
      ok: false,
      status: 415,
      error: "Content-Type must be application/json.",
    };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLen = Number(declaredLength);
    if (Number.isFinite(parsedLen) && parsedLen > maxBytes) {
      return { ok: false, status: 413, error: "Request payload too large." };
    }
  }

  let raw = "";
  if (request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          return { ok: false, status: 413, error: "Request payload too large." };
        }
        chunks.push(value);
      }
    } catch {
      return { ok: false, status: 400, error: "Unable to read request body." };
    }

    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    raw = SHARED_DECODER.decode(merged);
  } else {
    try {
      raw = await request.text();
    } catch {
      return { ok: false, status: 400, error: "Unable to read request body." };
    }
    if (utf8ByteLength(raw) > maxBytes) {
      return { ok: false, status: 413, error: "Request payload too large." };
    }
  }

  try {
    return { ok: true, data: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body." };
  }
}

export async function enforceRateLimit(
  request: Request,
  routeKey: string,
  maxRequests: number,
  windowSec: number,
  errorMessage: string,
  store: DistributedStore = getDistributedStore(),
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`${ip}:${routeKey}`, maxRequests, windowSec, store);
  if (limit.allowed) return null;

  return NextResponse.json(
    { error: errorMessage },
    {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSec) },
    },
  );
}

export function formatValidationErrors(
  issues: readonly z.core.$ZodIssue[],
): Array<{ field: string; message: string }> {
  return issues.slice(0, 5).map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}
