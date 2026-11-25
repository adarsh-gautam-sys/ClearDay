import { NextResponse } from "next/server";
import { fetchAirQuality, searchCities } from "@/lib/air-quality/openMeteo";
import { findPresetById } from "@/lib/air-quality/presets";
import { CoordinateQuerySchema } from "@/lib/schemas";
import { enforceRateLimit, formatValidationErrors } from "@/lib/security/http";
import { getDistributedStore } from "@/lib/storage/distributedStore";

const EDGE_CACHE_HEADER =
  "public, max-age=180, s-maxage=600, stale-while-revalidate=900";

export async function GET(request: Request) {
  const store = getDistributedStore();
  const rateLimitResponse = await enforceRateLimit(
    request,
    "/api/air-quality",
    60,
    60,
    "Too many air quality requests. Please retry shortly.",
    store,
  );
  if (rateLimitResponse) return rateLimitResponse;

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
      {
        headers: {
          "Cache-Control": EDGE_CACHE_HEADER,
          "X-Store-Backend": store.backend,
        },
      },
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
        {
          error: "Invalid coordinates supplied.",
          issues: formatValidationErrors(parsed.error.issues),
        },
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
      headers: {
        "Cache-Control": EDGE_CACHE_HEADER,
        "X-Store-Backend": store.backend,
      },
    });
  }

  const preset = findPresetById(searchParams.get("preset"));
  const snapshot = await fetchAirQuality(preset.location);
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": EDGE_CACHE_HEADER,
      "X-Store-Backend": store.backend,
    },
  });
}
