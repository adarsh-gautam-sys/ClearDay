import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { generateActionPlan, hasGeminiKey } from "@/lib/ai/gemini";
import { type ActionPlanResponse, PlanRequestSchema } from "@/lib/schemas";
import {
  DEFAULT_MAX_JSON_BYTES,
  enforceRateLimit,
  formatValidationErrors,
  readBoundedJson,
} from "@/lib/security/http";
import { getDistributedStore } from "@/lib/storage/distributedStore";

const PLAN_TTL_SEC = 15 * 60;

export async function POST(request: Request) {
  const store = getDistributedStore();
  const rateLimitResponse = await enforceRateLimit(
    request,
    "/api/plan",
    15,
    60,
    "Rate limit exceeded for action plan generation.",
    store,
  );
  if (rateLimitResponse) return rateLimitResponse;

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
  const aiConfigured = hasGeminiKey();
  const rawKey = JSON.stringify({
    lat: airQuality.location.latitude.toFixed(2),
    lon: airQuality.location.longitude.toFixed(2),
    band: airQuality.current.band,
    vent: airQuality.windows.bestVentilation.recommended,
    profile,
    ai: aiConfigured ? "gemini" : "fallback",
  });
  const cacheKey = `plan:v3:${createHash("sha256").update(rawKey).digest("hex").slice(0, 32)}`;

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
  if (!aiConfigured || plan.mode === "gemini") {
    await store.setJson(cacheKey, plan, PLAN_TTL_SEC);
  }

  return NextResponse.json(plan, {
    headers: {
      "X-Cache": "MISS",
      "X-AI-Mode": plan.mode,
      "X-Store-Backend": store.backend,
    },
  });
}
