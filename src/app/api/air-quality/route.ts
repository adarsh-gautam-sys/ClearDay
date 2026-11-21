import { NextResponse } from "next/server";
import { fetchAirQuality, searchCities } from "@/lib/air-quality/openMeteo";
import { findPresetById } from "@/lib/air-quality/presets";
import { CoordinateQuerySchema } from "@/lib/schemas";
import { getClientIp, SlidingWindowRateLimiter } from "@/lib/security/rateLimit";

const aqRateLimiter = new SlidingWindowRateLimiter(60, 60_000);

export function resetAirQualityRateLimit(): void {
  aqRateLimiter.clear();
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = aqRateLimiter.check(`${ip}:/api/air-quality`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many air quality requests. Please retry shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (query !== null) {
    if (query.trim().length > 80) {
      return NextResponse.json(
        { error: "City search query is too long." },
        { status: 400 },
      );
    }
    const results = await searchCities(query);
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  }

  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");

  if (latParam !== null || lonParam !== null) {
    const parsed = CoordinateQuerySchema.safeParse({
      lat: latParam,
      lon: lonParam,
      name: searchParams.get("name") ?? undefined,
      country: searchParams.get("country") ?? undefined,
      timezone: searchParams.get("timezone") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid coordinates supplied.", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const snapshot = await fetchAirQuality({
      name: parsed.data.name,
      country: parsed.data.country,
      latitude: parsed.data.lat,
      longitude: parsed.data.lon,
      timezone: parsed.data.timezone,
    });

    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  const preset = findPresetById(searchParams.get("preset"));
  const snapshot = await fetchAirQuality(preset.location);
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
