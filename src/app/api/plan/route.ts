import { NextResponse } from "next/server";
import { generateActionPlan, hasGeminiKey } from "@/lib/ai/gemini";
import { type ActionPlanResponse, PlanRequestSchema } from "@/lib/schemas";
import { TtlCache } from "@/lib/security/cache";
import { getClientIp, SlidingWindowRateLimiter } from "@/lib/security/rateLimit";

const planRateLimiter = new SlidingWindowRateLimiter(15, 60_000);
const planCache = new TtlCache<ActionPlanResponse>(150);
const PLAN_TTL_MS = 15 * 60 * 1000;

export function resetPlanRouteState(): void {
  planRateLimiter.clear();
  planCache.clear();
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = planRateLimiter.check(`${ip}:/api/plan`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded for action plan generation." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid plan request payload.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { airQuality, profile } = parsed.data;
  const cacheKey = JSON.stringify({
    lat: airQuality.location.latitude.toFixed(2),
    lon: airQuality.location.longitude.toFixed(2),
    band: airQuality.current.band,
    vent: airQuality.windows.bestVentilation.recommended,
    profile,
    ai: hasGeminiKey() ? "gemini" : "fallback",
  });

  const cached = planCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "X-Cache": "HIT",
        "X-AI-Mode": cached.mode,
      },
    });
  }

  const plan = await generateActionPlan(airQuality, profile);
  planCache.set(cacheKey, plan, PLAN_TTL_MS);

  return NextResponse.json(plan, {
    headers: {
      "X-Cache": "MISS",
      "X-AI-Mode": plan.mode,
    },
  });
}
