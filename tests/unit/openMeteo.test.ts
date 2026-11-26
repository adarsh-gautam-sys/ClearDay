import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAirQualityCache,
  fetchAirQuality,
  searchCities,
} from "@/lib/air-quality/openMeteo";
import { CITY_PRESETS } from "@/lib/air-quality/presets";

describe("Open-Meteo telemetry & geocoding client", () => {
  beforeEach(async () => {
    await clearAirQualityCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns curated presets for short queries and falls back cleanly on HTTP/network errors", async () => {
    const shortResults = await searchCities("a");
    expect(shortResults).toHaveLength(CITY_PRESETS.length);

    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("upstream error", { status: 500 }))
      .mockRejectedValueOnce(new Error("dns failure"));

    const httpFallback = await searchCities("Lahore");
    expect(httpFallback.some((loc) => loc.name === "Lahore")).toBe(true);

    const netFallback = await searchCities("Milan");
    expect(netFallback.some((loc) => loc.name === "Milan")).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("caches fetched telemetry and falls back when hourly array is empty", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            timezone: "Asia/Karachi",
            current: { time: "2026-11-26T06:00", us_aqi: 210, pm2_5: 160 },
            hourly: {
              time: ["2026-11-26T06:00", "2026-11-26T07:00"],
              us_aqi: [210, 225],
              pm2_5: [160, 172],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            timezone: "Asia/Shanghai",
            hourly: { time: [], us_aqi: [], pm2_5: [] },
          }),
          { status: 200 },
        ),
      );

    const first = await fetchAirQuality(CITY_PRESETS[1]!.location);
    expect(first.source).toBe("open-meteo");

    // Second call hits distributed cache and respects requested display name
    const cached = await fetchAirQuality({
      ...CITY_PRESETS[1]!.location,
      name: "Lahore Center",
    });
    expect(cached.source).toBe("open-meteo");
    expect(cached.location.name).toBe("Lahore Center");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Empty hourly series triggers graceful closest-preset fallback
    const emptyHourly = await fetchAirQuality(CITY_PRESETS[2]!.location);
    expect(emptyHourly.source).toBe("fallback");
    expect(emptyHourly.location.name).toBe("Beijing");
  });
});
