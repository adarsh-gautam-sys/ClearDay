import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getAirQuality } from "@/app/api/air-quality/route";
import { POST as postChat } from "@/app/api/chat/route";
import { GET as getHealth } from "@/app/api/health/route";
import { POST as postPlan } from "@/app/api/plan/route";
import { parseSseBuffer } from "@/lib/ai/sse";
import { clearAirQualityCache } from "@/lib/air-quality/openMeteo";
import { buildPresetSnapshot, CITY_PRESETS } from "@/lib/air-quality/presets";
import { ActionPlanResponseSchema, DEFAULT_PROFILE } from "@/lib/schemas";
import {
  resetDistributedStore,
  setDistributedStoreForTests,
} from "@/lib/storage/distributedStore";
import { ByteBoundedMemoryStore } from "@/lib/storage/memoryStore";

describe("API Route Handlers", () => {
  const sampleSnapshot = buildPresetSnapshot(CITY_PRESETS[0]!);

  beforeEach(async () => {
    setDistributedStoreForTests(null);
    await resetDistributedStore();
    await clearAirQualityCache();
    delete process.env.GEMINI_API_KEY;
    delete process.env.VERTEX_API_KEY;
    delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
    delete process.env.GOOGLE_CLOUD_PROJECT;
  });

  afterEach(() => {
    setDistributedStoreForTests(null);
    vi.restoreAllMocks();
  });

  it("GET /api/health reports backend store, AI readiness, and optional deep store probe", async () => {
    const res = await getHealth(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(json.store).toBe("memory-dev");
    expect(json.aiMode).toBe("fallback");

    const healthyProbe = await getHealth(
      new Request("http://localhost/api/health?probe=1"),
    );
    expect(healthyProbe.status).toBe(200);
    expect(await healthyProbe.json()).toMatchObject({
      status: "ok",
      storeHealthy: true,
    });

    const degradedStore = new ByteBoundedMemoryStore();
    degradedStore.ping = async () => false;
    setDistributedStoreForTests(degradedStore);

    const degradedProbe = await getHealth(
      new Request("http://localhost/api/health?probe=1"),
    );
    expect(degradedProbe.status).toBe(503);
    expect(await degradedProbe.json()).toMatchObject({
      status: "degraded",
      storeHealthy: false,
    });
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

    await clearAirQualityCache();
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

  it("POST /api/plan rejects >32 KiB payloads with 413, caches requests, and enforces rate limit", async () => {
    const tooBig = await postPlan(
      new Request("http://localhost/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1" },
        body: JSON.stringify({ pad: "x".repeat(35_000) }),
      }),
    );
    expect(tooBig.status).toBe(413);

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

  it("POST /api/chat emits valid SSE frames, rejects >500 chars, and sets medical alert", async () => {
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
    expect(emergencyRes.headers.get("Content-Type")).toContain("text/event-stream");
    expect(emergencyRes.headers.get("X-Medical-Alert")).toBe("true");

    const rawSse = await emergencyRes.text();
    const { events } = parseSseBuffer(rawSse);
    expect(events[0]).toEqual({
      event: "meta",
      data: { mode: "fallback", medicalAlert: true },
    });
    const combinedText = events
      .filter((e) => e.event === "chunk")
      .map((e) => e.data.text)
      .join("");
    expect(combinedText).toContain("emergency medical care");
    expect(events[events.length - 1]).toEqual({
      event: "done",
      data: { ok: true },
    });
  });

  it("validates search queries, enforces Content-Type 415, and rate-limits health probes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            {
              name: "New Delhi",
              country: "India",
              latitude: 28.6139,
              longitude: 77.209,
              timezone: "Asia/Kolkata",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const searchRes = await getAirQuality(
      new Request("http://localhost/api/air-quality?q=Delhi"),
    );
    expect(searchRes.status).toBe(200);
    const searchJson = (await searchRes.json()) as {
      results: Array<{ name: string }>;
    };
    expect(searchJson.results[0]?.name).toBe("New Delhi");

    const tooLongQuery = await getAirQuality(
      new Request(`http://localhost/api/air-quality?q=${"a".repeat(81)}`),
    );
    expect(tooLongQuery.status).toBe(400);

    const wrongMime = await postChat(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "hi",
      }),
    );
    expect(wrongMime.status).toBe(415);

    for (let i = 0; i < 10; i++) {
      const okProbe = await getHealth(
        new Request("http://localhost/api/health?probe=1", {
          headers: { "x-forwarded-for": "198.51.100.4" },
        }),
      );
      expect(okProbe.status).toBe(200);
    }
    const throttledProbe = await getHealth(
      new Request("http://localhost/api/health?probe=1", {
        headers: { "x-forwarded-for": "198.51.100.4" },
      }),
    );
    expect(throttledProbe.status).toBe(429);
  });
});
