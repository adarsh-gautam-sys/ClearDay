"use client";

import {
  AlertCircle,
  AlertTriangle,
  Clock,
  OctagonAlert,
  ShieldAlert,
  ShieldCheck,
  Wind,
} from "lucide-react";
import type { AirQualitySnapshot, AqiBand } from "@/lib/schemas";
import { AQI_VISUAL_STYLE } from "@/lib/ui/aqiTheme";
import { HourlySmogChart } from "./HourlySmogChart";

interface AirBriefingCardProps {
  airQuality: AirQualitySnapshot;
}

function BandIcon({ band }: { band: AqiBand }) {
  const cls = "h-4 w-4 shrink-0";
  switch (band) {
    case "good":
      return <ShieldCheck className={cls} aria-hidden="true" />;
    case "moderate":
      return <Wind className={cls} aria-hidden="true" />;
    case "sensitive":
      return <AlertCircle className={cls} aria-hidden="true" />;
    case "unhealthy":
      return <AlertTriangle className={cls} aria-hidden="true" />;
    case "very_unhealthy":
      return <ShieldAlert className={cls} aria-hidden="true" />;
    case "hazardous":
      return <OctagonAlert className={cls} aria-hidden="true" />;
  }
}

export function AirBriefingCard({ airQuality }: AirBriefingCardProps) {
  const { location, current, windows, hourly } = airQuality;
  const style = AQI_VISUAL_STYLE[current.band];

  const pollutants = [
    { label: "PM2.5", value: current.pm25.toFixed(1), unit: "µg/m³" },
    { label: "PM10", value: current.pm10.toFixed(1), unit: "µg/m³" },
    { label: "NO₂", value: current.no2.toFixed(1), unit: "µg/m³" },
    { label: "O₃", value: current.o3.toFixed(1), unit: "µg/m³" },
    { label: "CO", value: String(current.co), unit: "µg/m³" },
  ];

  return (
    <section
      aria-labelledby="air-briefing-heading"
      className="rounded-xl border border-[#D8D2C5] bg-[#FCFBF8] p-4 shadow-beautiful-md sm:p-5"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#52525B]">
            00 · ATMOSPHERIC TELEMETRY
          </p>
          <h1
            id="air-briefing-heading"
            className="mt-1 text-xl font-bold tracking-tight text-[#18181B] sm:text-2xl"
          >
            {location.name}, {location.country}
          </h1>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${style.pillClass}`}
        >
          <BandIcon band={current.band} />
          <span>{current.categoryLabel}</span>
        </div>
      </div>

      {/* Hero AQI Metric + Summary */}
      <div className="mt-4 grid gap-4 border-y border-[#E5E0D5] py-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-baseline gap-2.5 pr-4 sm:border-r sm:border-[#E5E0D5]">
          <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-[#18181B] sm:text-5xl">
            {current.usAqi}
          </span>
          <div className="flex flex-col">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0F6E6E]">
              US AQI
            </span>
            <span className="font-mono text-[11px] text-[#52525B]">
              EPA Scale
            </span>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-[#3F3F46]">
          {current.healthSummary}
        </p>
      </div>

      {/* Pollutant Strip */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {pollutants.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] px-2.5 py-2"
          >
            <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-[#52525B]">
              {item.label}
            </div>
            <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#18181B]">
              {item.value}{" "}
              <span className="text-[10px] font-normal text-[#52525B]">
                {item.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Winter Inversion Windows */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div
          className={
            windows.bestVentilation.recommended
              ? "rounded-lg border border-[#B2DBD4] bg-[#E6F4F1]/65 p-3"
              : "rounded-lg border border-[#FCA5A5] bg-[#FEE2E2]/55 p-3"
          }
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#18181B]">
              <Clock className="h-3.5 w-3.5 text-[#0F6E6E]" aria-hidden="true" />
              {windows.bestVentilation.recommended
                ? "Cleanest Ventilation Window"
                : "Ventilation Hold"}
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-[#18181B]">
              {windows.bestVentilation.startLabel}–{windows.bestVentilation.endLabel}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#3F3F46]">
            {windows.bestVentilation.guidance}{" "}
            <span className="font-mono font-medium tabular-nums">
              (~{windows.bestVentilation.avgPm25} µg/m³)
            </span>
          </p>
        </div>

        <div className="rounded-lg border border-[#FDBA74] bg-[#FFEDD5]/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#9A3412]">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Peak Inversion Hazard
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-[#9A3412]">
              {windows.peakHazard.startLabel}–{windows.peakHazard.endLabel}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#3F3F46]">
            {windows.peakHazard.guidance}{" "}
            <span className="font-mono font-medium tabular-nums">
              (~{windows.peakHazard.avgPm25} µg/m³)
            </span>
          </p>
        </div>
      </div>

      {/* 24h Hourly Curve + Accessible Table Toggle */}
      <HourlySmogChart
        hourly={hourly}
        strokeColor={style.strokeColor}
        cityName={location.name}
      />
    </section>
  );
}
