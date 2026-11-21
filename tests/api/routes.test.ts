import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GET as getAirQuality,
  resetAirQualityRateLimit,
} from "@/app/api/air-quality/route";
import { POST as postChat, resetChatRateLimit } from "@/app/api/chat/route";
import { POST as postPlan, resetPlanRouteState } from "@/app/api/plan/route";
import { clearAirQualityCache } from "@/lib/air-quality/openMeteo";
import { buildPresetSnapshot, CITY_PRESETS } from "@/lib/air-quality/presets";
import { ActionPlanResponseSchema, DEFAULT_PROFILE } from "@/lib/schemas";

describe("API Route Handlers", () => {
  const sampleSnapshot = buildPresetSnapshot(CITY_PRESETS[0]!);

  beforeEach(() => {
    resetAirQualityRateLimit();
    resetPlanRouteState();
    resetChatRateLimit();
    clearAirQualityCache();
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/air-quality rejects out-of-range coordinates with 400", async () => {
    const req = new Request("http://localhost/api/air-quality?lat=120&lon=77");
    const res = await getAirQuality(req);
    expect(res.status).toBe(400);
  });

  it("GET /api/air-quality parses mocked Open-Meteo response and falls back on network failure", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          timezone: "Asia/Kolkata",
          current: {
            time: "2026-11-21T15:00",
            us_aqi: 222,
            pm2_5: 142.5,
            pm10: 210,
            nitrogen_dioxide: 52,
            ozone: 38,
            carbon_monoxide: 1400,
          },
          hourly: {
            time: [
              "2026-11-21T15:00",
              "2026-11-21T16:00",
              "2026-11-21T17:00",
            ],
            us_aqi: [222, 230, 260],
            pm2_5: [142.5, 150, 185],
          },
        }),
        { status: 200 },
      ),
    );

    const liveRes = await getAirQuality(
      new Request(
        "http://localhost/api/air-quality?lat=28.61&lon=77.21&name=Delhi&country=India",
      ),
    );
    expect(liveRes.status).toBe(200);
    const liveBody = await liveRes.json();
    expect(liveBody.source).toBe("open-meteo");
    expect(liveBody.current.usAqi).toBe(222);

    // Clear cache and force upstream rejection -> clean fallback
    clearAirQualityCache();
    mockFetch.mockRejectedValueOnce(new Error("network offline"));
    const fallbackRes = await getAirQuality(
      new Request(
        "http://localhost/api/air-quality?lat=28.61&lon=77.21&name=Delhi&country=India",
      ),
    );
    expect(fallbackRes.status).toBe(200);
    const fallbackBody = await fallbackRes.json();
    expect(fallbackBody.source).toBe("fallback");
  });

  it("POST /api/plan validates input, caches identical requests, and enforces rate limit", async () => {
    const badRes = await postPlan(
      new Request("http://localhost/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1" },
        body: JSON.stringify({ invalid: true }),
      }),
    );
    expect(badRes.status).toBe(400);

    const payload = JSON.stringify({
      airQuality: sampleSnapshot,
      profile: DEFAULT_PROFILE,
    });

    const first = await postPlan(
      new Request("http://localhost/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.2" },
        body: payload,
      }),
    );
    expect(first.status).toBe(200);
    expect(first.headers.get("X-Cache")).toBe("MISS");
    expect(first.headers.get("X-AI-Mode")).toBe("fallback");
    const firstJson = await first.json();
    expect(ActionPlanResponseSchema.safeParse(firstJson).success).toBe(true);

    const second = await postPlan(
      new Request("http://localhost/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.2" },
        body: payload,
      }),
    );
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Cache")).toBe("HIT");

    // Exhaust 15 req/min limit for IP 10.0.0.99
    for (let i = 0; i < 15; i++) {
      const ok = await postPlan(
        new Request("http://localhost/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.99" },
          body: payload,
        }),
      );
      expect(ok.status).toBe(200);
    }
    const throttled = await postPlan(
      new Request("http://localhost/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.99" },
        body: payload,
      }),
    );
    expect(throttled.status).toBe(429);
  });

  it("POST /api/chat streams reply, rejects >500 chars, and sets medical alert header", async () => {
    const overLimit = await postChat(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          airQuality: sampleSnapshot,
          profile: DEFAULT_PROFILE,
          adoptedTitles: [],
          history: [],
          message: "x".repeat(501),
        }),
      }),
    );
    expect(overLimit.status).toBe(400);

    const emergencyRes = await postChat(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          airQuality: sampleSnapshot,
          profile: DEFAULT_PROFILE,
          adoptedTitles: ["Build DIY filter"],
          history: [],
          message: "My dad has chest pain and difficulty breathing",
        }),
      }),
    );
    expect(emergencyRes.status).toBe(200);
    expect(emergencyRes.headers.get("X-Medical-Alert")).toBe("true");
    const streamed = await emergencyRes.text();
    expect(streamed).toContain("emergency medical care");
  });
});
