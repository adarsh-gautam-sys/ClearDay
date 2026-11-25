import type { z } from "zod";

export const DEFAULT_MAX_JSON_BYTES = 32_768;

export type BoundedJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; status: 400 | 413; error: string };

/**
 * Reads and parses a JSON request body while enforcing a strict UTF-8 byte ceiling
 * to protect Cloud Run containers from oversized-body memory pressure.
 */
export async function readBoundedJson(
  request: Request,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<BoundedJsonResult> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLen = Number(declaredLength);
    if (Number.isFinite(parsedLen) && parsedLen > maxBytes) {
      return { ok: false, status: 413, error: "Request payload too large." };
    }
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, status: 400, error: "Unable to read request body." };
  }

  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { ok: false, status: 413, error: "Request payload too large." };
  }

  try {
    return { ok: true, data: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON body." };
  }
}

export function formatValidationErrors(
  issues: readonly z.core.$ZodIssue[],
): Array<{ field: string; message: string }> {
  return issues.slice(0, 5).map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}
