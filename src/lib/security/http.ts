import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { logError } from "../observability/logger";
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

/**
 * Verifies same-origin browser POST requests when an Origin header is supplied,
 * defending state-changing routes against cross-site request forgery.
 */
export function verifySameOrigin(request: Request): NextResponse | null {
  const originHeader = request.headers.get("origin")?.trim();
  if (!originHeader) return null;

  let parsedOrigin: string;
  try {
    parsedOrigin = new URL(originHeader).origin;
  } catch {
    return NextResponse.json(
      { error: "Invalid Origin header." },
      { status: 403 },
    );
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();

  let expectedOrigin: string;
  try {
    const reqUrl = new URL(request.url);
    const proto = forwardedProto || reqUrl.protocol.replace(/:$/, "");
    expectedOrigin = host ? `${proto}://${host}` : reqUrl.origin;
  } catch {
    expectedOrigin = "";
  }

  if (!expectedOrigin || parsedOrigin !== expectedOrigin) {
    return NextResponse.json(
      { error: "Cross-origin requests are not permitted." },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Wraps route handlers with correlation Request-Id propagation and sanitized
 * 500 error boundaries so unhandled errors never leak stack traces.
 */
export async function withApiErrorHandling(
  route: string,
  request: Request,
  handler: (request: Request, requestId: string) => Promise<Response>,
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const res = await handler(request, requestId);
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unexpected_error";
    logError("API", `Unhandled exception in ${route}`, {
      route,
      requestId,
      reason,
    });
    return NextResponse.json(
      { error: "Internal server error.", requestId },
      { status: 500, headers: { "X-Request-Id": requestId } },
    );
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
