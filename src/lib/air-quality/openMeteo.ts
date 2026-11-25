import type { AirQualitySnapshot, HourlyPoint, LocationInfo } from "../schemas";
import {
  getDistributedStore,
  resetDistributedStore,
} from "../storage/distributedStore";
import { classifyUsAqi, detectSmogWindows } from "./analyzer";
import { buildPresetSnapshot, CITY_PRESETS } from "./presets";

const AQ_TTL_SEC = 15 * 60;

interface GeocodingApiResult {
  name?: string;
  country?: string;
  admin1?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

interface OpenMeteoAqResponse {
  timezone?: string;
  current?: {
    time?: string;
    us_aqi?: number;
    pm2_5?: number;
    pm10?: number;
    nitrogen_dioxide?: number;
    ozone?: number;
    carbon_monoxide?: number;
  };
  hourly?: {
    time?: string[];
    us_aqi?: Array<number | null>;
    pm2_5?: Array<number | null>;
  };
}

export async function clearAirQualityCache(): Promise<void> {
  await resetDistributedStore();
}

export async function searchCities(query: string): Promise<LocationInfo[]> {
  const clean = query.trim();
  if (clean.length < 2) {
    return CITY_PRESETS.map((p) => p.location);
  }

  const presetMatches = CITY_PRESETS.filter((p) =>
    `${p.location.name} ${p.location.country}`
      .toLowerCase()
      .includes(clean.toLowerCase()),
  ).map((p) => p.location);

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", clean);
    url.searchParams.set("count", "6");
    url.searchParams.set("language", "en");
    url.searchParams.set("format", "json");

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return presetMatches;

    const json = (await res.json()) as { results?: GeocodingApiResult[] };
    const remote = (json.results ?? [])
      .filter(
        (r) =>
          typeof r.name === "string" &&
          typeof r.latitude === "number" &&
          typeof r.longitude === "number",
      )
      .map((r) => ({
        name: r.name!,
        country: r.country ?? r.admin1 ?? "Region",
        latitude: Math.round(r.latitude! * 10000) / 10000,
        longitude: Math.round(r.longitude! * 10000) / 10000,
        timezone: r.timezone ?? "auto",
      }));

    return remote.length > 0 ? remote : presetMatches;
  } catch {
    return presetMatches;
  }
}

function findClosestPreset(location: LocationInfo) {
  let best = CITY_PRESETS[0]!;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const preset of CITY_PRESETS) {
    const dLat = preset.location.latitude - location.latitude;
    const dLon = preset.location.longitude - location.longitude;
    const dist = dLat * dLat + dLon * dLon;
    if (dist < bestDist) {
      bestDist = dist;
      best = preset;
    }
  }
  return best;
}

function formatHourLabel(isoLocal: string): string {
  const timePart = isoLocal.split("T")[1];
  return timePart ? timePart.slice(0, 5) : "00:00";
}

export async function fetchAirQuality(
  location: LocationInfo,
): Promise<AirQualitySnapshot> {
  const store = getDistributedStore();
  const cacheKey = `aq:v1:${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
  const cached = await store.getJson<AirQualitySnapshot>(cacheKey);
  if (cached) {
    return {
      ...cached,
      location: {
        ...cached.location,
        name: location.name,
        country: location.country,
      },
    };
  }

  try {
    const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set(
      "current",
      "us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,carbon_monoxide",
    );
    url.searchParams.set("hourly", "pm2_5,us_aqi");
    url.searchParams.set("forecast_days", "2");
    url.searchParams.set("timezone", "auto");

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }

    const data = (await res.json()) as OpenMeteoAqResponse;
    const times = data.hourly?.time ?? [];
    const pm25Series = data.hourly?.pm2_5 ?? [];
    const aqiSeries = data.hourly?.us_aqi ?? [];

    const currentTime = data.current?.time ?? times[0] ?? "";
    const startIdx = Math.max(
      0,
      times.findIndex((t) => t >= currentTime),
    );

    const hourly: HourlyPoint[] = [];
    for (let i = startIdx; i < Math.min(times.length, startIdx + 24); i++) {
      const t = times[i];
      if (!t) continue;
      hourly.push({
        time: t,
        hourLabel: formatHourLabel(t),
        pm25: Math.max(0, Math.round((pm25Series[i] ?? 0) * 10) / 10),
        usAqi: Math.max(0, Math.round(aqiSeries[i] ?? 0)),
      });
    }

    if (hourly.length === 0) {
      throw new Error("Open-Meteo returned empty hourly array");
    }

    const currentAqi = Math.max(
      0,
      Math.round(data.current?.us_aqi ?? hourly[0]?.usAqi ?? 0),
    );
    const currentPm25 = Math.max(
      0,
      Math.round((data.current?.pm2_5 ?? hourly[0]?.pm25 ?? 0) * 10) / 10,
    );
    const classification = classifyUsAqi(currentAqi);

    const snapshot: AirQualitySnapshot = {
      location: {
        ...location,
        timezone: data.timezone ?? location.timezone,
      },
      fetchedAt: new Date().toISOString(),
      source: "open-meteo",
      current: {
        usAqi: currentAqi,
        pm25: currentPm25,
        pm10: Math.max(
          0,
          Math.round((data.current?.pm10 ?? currentPm25 * 1.4) * 10) / 10,
        ),
        no2: Math.max(
          0,
          Math.round((data.current?.nitrogen_dioxide ?? 0) * 10) / 10,
        ),
        o3: Math.max(0, Math.round((data.current?.ozone ?? 0) * 10) / 10),
        co: Math.max(0, Math.round(data.current?.carbon_monoxide ?? 0)),
        band: classification.band,
        categoryLabel: classification.categoryLabel,
        healthSummary: classification.healthSummary,
      },
      hourly,
      windows: detectSmogWindows(hourly),
    };

    await store.setJson(cacheKey, snapshot, AQ_TTL_SEC);
    return snapshot;
  } catch {
    const closest = findClosestPreset(location);
    return buildPresetSnapshot({
      ...closest,
      location,
    });
  }
}
