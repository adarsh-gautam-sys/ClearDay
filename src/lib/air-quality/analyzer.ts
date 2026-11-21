import type { AqiBand, HourlyPoint } from "../schemas";

export interface AqiClassification {
  band: AqiBand;
  categoryLabel: string;
  healthSummary: string;
}

/** Classifies a US EPA Air Quality Index value into standard severity bands. */
export function classifyUsAqi(rawAqi: number): AqiClassification {
  const aqi = Number.isFinite(rawAqi) ? Math.max(0, Math.round(rawAqi)) : 0;

  if (aqi <= 50) {
    return {
      band: "good",
      categoryLabel: "Good",
      healthSummary:
        "Air is crisp and poses minimal respiratory risk. Normal outdoor activity and cross-ventilation are safe.",
    };
  }
  if (aqi <= 100) {
    return {
      band: "moderate",
      categoryLabel: "Moderate",
      healthSummary:
        "Acceptable air for most people; unusually sensitive individuals should watch for mild irritation during heavy exertion.",
    };
  }
  if (aqi <= 150) {
    return {
      band: "sensitive",
      categoryLabel: "Unhealthy for Sensitive Groups",
      healthSummary:
        "Children, older adults, and people with asthma should shorten vigorous outdoor exercise and ventilate only during midday dips.",
    };
  }
  if (aqi <= 200) {
    return {
      band: "unhealthy",
      categoryLabel: "Unhealthy",
      healthSummary:
        "Everyone may begin to experience respiratory irritation. Shift errands to midday, wear N95/KN95 outdoors, and seal drafts.",
    };
  }
  if (aqi <= 300) {
    return {
      band: "very_unhealthy",
      categoryLabel: "Very Unhealthy",
      healthSummary:
        "Health alert: winter smog levels trigger widespread airway stress. Avoid outdoor exercise, seal windows, and run indoor filtration.",
    };
  }
  return {
    band: "hazardous",
    categoryLabel: "Hazardous",
    healthSummary:
      "Emergency smog conditions. Keep children and sensitive groups indoors, seal entry gaps, eliminate indoor smoke, and filter room air continuously.",
  };
}

export interface SmogWindowsAnalysis {
  bestVentilation: {
    startLabel: string;
    endLabel: string;
    avgPm25: number;
    recommended: boolean;
    guidance: string;
  };
  peakHazard: {
    startLabel: string;
    endLabel: string;
    avgPm25: number;
    guidance: string;
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Finds the cleanest 2-hour ventilation window and peak 3-hour winter inversion
 * hazard window across a 24-hour forecast series.
 */
export function detectSmogWindows(
  hourly: HourlyPoint[],
): SmogWindowsAnalysis {
  if (hourly.length === 0) {
    return {
      bestVentilation: {
        startLabel: "14:00",
        endLabel: "16:00",
        avgPm25: 55,
        recommended: false,
        guidance:
          "Hourly telemetry unavailable. Keep windows closed until local readings confirm PM2.5 drops below 55 µg/m³.",
      },
      peakHazard: {
        startLabel: "07:00",
        endLabel: "10:00",
        avgPm25: 120,
        guidance:
          "Winter inversions typically peak near sunrise and late evening. Avoid strenuous outdoor activity during those hours.",
      },
    };
  }

  const ventSpan = Math.min(2, hourly.length);
  let bestStart = 0;
  let bestAvg = Number.POSITIVE_INFINITY;

  for (let i = 0; i <= hourly.length - ventSpan; i++) {
    let sum = 0;
    for (let j = 0; j < ventSpan; j++) {
      sum += hourly[i + j]?.pm25 ?? 0;
    }
    const avg = sum / ventSpan;
    if (avg < bestAvg) {
      bestAvg = avg;
      bestStart = i;
    }
  }

  const peakSpan = Math.min(3, hourly.length);
  let peakStart = 0;
  let peakAvg = Number.NEGATIVE_INFINITY;

  for (let i = 0; i <= hourly.length - peakSpan; i++) {
    let sum = 0;
    for (let j = 0; j < peakSpan; j++) {
      sum += hourly[i + j]?.pm25 ?? 0;
    }
    const avg = sum / peakSpan;
    if (avg > peakAvg) {
      peakAvg = avg;
      peakStart = i;
    }
  }

  const bestEndIdx = Math.min(hourly.length - 1, bestStart + ventSpan - 1);
  const peakEndIdx = Math.min(hourly.length - 1, peakStart + peakSpan - 1);
  const roundedBest = round1(bestAvg);
  const roundedPeak = round1(peakAvg);

  let recommended = false;
  let ventGuidance =
    "Keep windows sealed — outdoor PM2.5 remains hazardous all day; rely on HEPA or DIY box-fan filtration indoors.";

  if (roundedBest <= 35) {
    recommended = true;
    ventGuidance =
      "Brief 15–20 min cross-ventilation window when thermal mixing dilutes surface smog.";
  } else if (roundedBest <= 55) {
    recommended = true;
    ventGuidance =
      "Short 10-min air purge only if indoor CO₂/cooking odors feel stale; restart filtration immediately afterward.";
  }

  const peakGuidance =
    roundedPeak > 100
      ? "Severe inversion trapping expected. Keep school runs masked (N95/KN95) and shift errands out of this window."
      : "Highest particulate concentration of the day. Prefer indoor play and avoid roadside walking during these hours.";

  return {
    bestVentilation: {
      startLabel: hourly[bestStart]?.hourLabel ?? "13:00",
      endLabel: hourly[bestEndIdx]?.hourLabel ?? "15:00",
      avgPm25: roundedBest,
      recommended,
      guidance: ventGuidance,
    },
    peakHazard: {
      startLabel: hourly[peakStart]?.hourLabel ?? "07:00",
      endLabel: hourly[peakEndIdx]?.hourLabel ?? "10:00",
      avgPm25: roundedPeak,
      guidance: peakGuidance,
    },
  };
}
