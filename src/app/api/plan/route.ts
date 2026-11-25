import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { generateActionPlan, hasGeminiKey } from "@/lib/ai/gemini";
import { type ActionPlanResponse, PlanRequestSchema } from "@/lib/schemas";
import {
  DEFAULT_MAX_JSON_BYTES,
  formatValidationErrors,
  readBoundedJson,
} from "@/lib/security/http";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { getDistributedStore } from "@/lib/storage/distributedStore";

const PLAN_TTL_SEC = 15 * 60;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const store = getDistributedStore();
  const limit = await checkRateLimit(`${ip}:/api/plan`, 15, 60, store);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded for action plan generation." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  const bodyResult = await readBoundedJson(request, DEFAULT_MAX_JSON_BYTES);
  if (!bodyResult.ok) {
    return NextResponse.json(
      { error: bodyResult.error },
      { status: bodyResult.status },
    );
  }

  const parsed = PlanRequestSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid plan request payload.",
        issues: formatValidationErrors(parsed.error.issues),
      },
      { status: 400 },
    );
  }

  const { airQuality, profile } = parsed.data;
  const rawKey = JSON.stringify({
    lat: airQuality.location.latitude.toFixed(2),
    lon: airQuality.location.longitude.toFixed(2),
    band: airQuality.current.band,
    vent: airQuality.windows.bestVentilation.recommended,
    profile,
    ai: hasGeminiKey() ? "gemini" : "fallback",
  });
  const cacheKey = `plan:v1:${createHash("sha256").update(rawKey).digest("hex").slice(0, 32)}`;

  const cached = await store.getJson<ActionPlanResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "X-Cache": "HIT",
        "X-AI-Mode": cached.mode,
        "X-Store-Backend": store.backend,
      },
    });
  }

  const plan = await generateActionPlan(airQuality, profile);
  await store.setJson(cacheKey, plan, PLAN_TTL_SEC);

  return NextResponse.json(plan, {
    headers: {
      "X-Cache": "MISS",
      "X-AI-Mode": plan.mode,
      "X-Store-Backend": store.backend,
    },
  });
}
