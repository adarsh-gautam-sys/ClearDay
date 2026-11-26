import type { AirQualitySnapshot, HourlyPoint, LocationInfo } from "../schemas";
import { classifyUsAqi, detectSmogWindows } from "./analyzer";

export interface CityPreset {
  id: string;
  location: LocationInfo;
  baselineAqi: number;
  baselinePm25: number;
  pm10: number;
  no2: number;
  o3: number;
  co: number;
}

export const CITY_PRESETS: readonly CityPreset[] = [
  {
    id: "new-delhi",
    location: {
      name: "New Delhi",
      country: "India",
      latitude: 28.6139,
      longitude: 77.209,
      timezone: "Asia/Kolkata",
    },
    baselineAqi: 312,
    baselinePm25: 238,
    pm10: 342,
    no2: 68,
    o3: 32,
    co: 1850,
  },
  {
    id: "lahore",
    location: {
      name: "Lahore",
      country: "Pakistan",
      latitude: 31.5204,
      longitude: 74.3587,
      timezone: "Asia/Karachi",
    },
    baselineAqi: 286,
    baselinePm25: 214,
    pm10: 310,
    no2: 61,
    o3: 29,
    co: 1680,
  },
  {
    id: "beijing",
    location: {
      name: "Beijing",
      country: "China",
      latitude: 39.9042,
      longitude: 116.4074,
      timezone: "Asia/Shanghai",
    },
    baselineAqi: 178,
    baselinePm25: 106,
    pm10: 158,
    no2: 54,
    o3: 41,
    co: 1120,
  },
  {
    id: "salt-lake-city",
    location: {
      name: "Salt Lake City",
      country: "United States",
      latitude: 40.7608,
      longitude: -111.891,
      timezone: "America/Denver",
    },
    baselineAqi: 134,
    baselinePm25: 49,
    pm10: 72,
    no2: 46,
    o3: 48,
    co: 640,
  },
  {
    id: "milan",
    location: {
      name: "Milan",
      country: "Italy",
      latitude: 45.4642,
      longitude: 9.19,
      timezone: "Europe/Rome",
    },
    baselineAqi: 148,
    baselinePm25: 54,
    pm10: 82,
    no2: 52,
    o3: 38,
    co: 710,
  },
  {
    id: "krakow",
    location: {
      name: "Krakow",
      country: "Poland",
      latitude: 50.0647,
      longitude: 19.945,
      timezone: "Europe/Warsaw",
    },
    baselineAqi: 166,
    baselinePm25: 84,
    pm10: 118,
    no2: 48,
    o3: 34,
    co: 940,
  },
];

// Typical winter diurnal boundary-layer multipliers: morning & night inversion peaks, afternoon dip.
const WINTER_DIURNAL_FACTORS = [
  1.12, 1.08, 1.04, 1.02, 1.05, 1.14, 1.24, 1.28, 1.18, 0.98, 0.82, 0.72,
  0.64, 0.58, 0.56, 0.62, 0.74, 0.91, 1.09, 1.21, 1.26, 1.22, 1.18, 1.14,
] as const;

/** Builds a realistic deterministic winter smog snapshot when upstream telemetry is offline. */
export function buildPresetSnapshot(
  preset: CityPreset,
  now = new Date(),
): AirQualitySnapshot {
  const startHour = now.getHours();
  const baseDate = new Date(now);
  baseDate.setMinutes(0, 0, 0);

  const hourly: HourlyPoint[] = [];
  for (let offset = 0; offset < 24; offset++) {
    const slot = new Date(baseDate.getTime() + offset * 3_600_000);
    const hour = (startHour + offset) % 24;
    const factor = WINTER_DIURNAL_FACTORS[hour] ?? 1;
    const pm25 = Math.round(preset.baselinePm25 * factor * 10) / 10;
    const usAqi = Math.max(10, Math.round(preset.baselineAqi * (0.35 + factor * 0.65)));
    hourly.push({
      time: slot.toISOString().slice(0, 16),
      hourLabel: `${String(hour).padStart(2, "0")}:00`,
      usAqi,
      pm25,
    });
  }

  const classification = classifyUsAqi(preset.baselineAqi);
  const windows = detectSmogWindows(hourly);

  return {
    location: preset.location,
    fetchedAt: now.toISOString(),
    source: "fallback",
    current: {
      usAqi: preset.baselineAqi,
      pm25: preset.baselinePm25,
      pm10: preset.pm10,
      no2: preset.no2,
      o3: preset.o3,
      co: preset.co,
      band: classification.band,
      categoryLabel: classification.categoryLabel,
      healthSummary: classification.healthSummary,
    },
    hourly,
    windows,
  };
}

export function findPresetById(id?: string | null): CityPreset {
  const defaultPreset = CITY_PRESETS[0];
  if (!defaultPreset) {
    throw new Error("CITY_PRESETS must define at least one city");
  }
  if (!id) return defaultPreset;
  return CITY_PRESETS.find((p) => p.id === id) ?? defaultPreset;
}
