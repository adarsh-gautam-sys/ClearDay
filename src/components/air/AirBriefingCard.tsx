"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Home,
  OctagonAlert,
  ShieldAlert,
  ShieldCheck,
  Trees,
  Wind,
} from "lucide-react";
import { BlurText } from "@/components/reactbits/BlurText";
import { CountUp } from "@/components/reactbits/CountUp";
import { SmogAtmosphereCanvas } from "@/components/three/SmogAtmosphereCanvas";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AirQualitySnapshot, AqiBand } from "@/lib/schemas";
import { AQI_VISUAL_STYLE } from "@/lib/ui/aqiTheme";
import { HourlySmogChart } from "./HourlySmogChart";

interface AirBriefingCardProps {
  airQuality: AirQualitySnapshot;
  indoorPm25After: number;
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

const POLLUTANT_HINTS: Record<string, string> = {
  "PM2.5": "Fine inhalable particles ≤2.5 µm that penetrate deep into lungs and bloodstream.",
  PM10: "Coarse dust and soot particles ≤10 µm that irritate upper airways.",
  "NO₂": "Traffic & gas-stove nitrogen dioxide that inflames airways during inversions.",
  "O₃": "Ground-level ozone formed by sunlight reacting with urban exhaust.",
  CO: "Colorless combustion gas from idling engines and unvented burning.",
};

export function AirBriefingCard({
  airQuality,
  indoorPm25After,
}: AirBriefingCardProps) {
  const { location, current, windows, hourly } = airQuality;
  const style = AQI_VISUAL_STYLE[current.band];
  const [atmosphereView, setAtmosphereView] = useState<"outdoor" | "indoor">(
    "outdoor",
  );
  const [scrubbedPm25, setScrubbedPm25] = useState<number | null>(null);

  // Reset scrubbed hour whenever the city changes
  useEffect(() => {
    setScrubbedPm25(null);
  }, [location.name, location.latitude, location.longitude]);

  const activeOutdoorPm25 = scrubbedPm25 ?? current.pm25;
  const simulatedPm25 =
    atmosphereView === "indoor" ? indoorPm25After : activeOutdoorPm25;

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
      {/* Interactive Three.js Atmospheric Stage */}
      <div className="relative overflow-hidden rounded-xl border border-[#D8D2C5] p-4 sm:p-5">
        <SmogAtmosphereCanvas pm25={simulatedPm25} />

        {/* Frosted reading scrim preserving WCAG contrast over live 3D particles */}
        <div className="relative z-10 rounded-xl border border-[#D8D2C5]/80 bg-[#FCFBF8]/88 p-4 shadow-beautiful-sm backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1
                id="air-briefing-heading"
                className="text-xl font-bold tracking-tight text-[#18181B] sm:text-2xl"
              >
                <BlurText
                  text={`${location.name}, ${location.country}`}
                  animateKey={`${location.name}-${location.latitude}`}
                />
              </h1>
              <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[#52525B]">
                Viewing{" "}
                {atmosphereView === "indoor"
                  ? `filtered indoor air (~${indoorPm25After} µg/m³)`
                  : scrubbedPm25 !== null
                    ? `scrubbed hour (~${scrubbedPm25} µg/m³)`
                    : `live outdoor conditions (${current.pm25.toFixed(1)} µg/m³)`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Interactive 3D Outdoor vs. Inside Plan Toggle */}
              <div
                role="group"
                aria-label="Atmospheric simulation view"
                className="inline-flex rounded-lg border border-[#D8D2C5] bg-[#F6F4EF] p-0.5 shadow-beautiful-sm"
              >
                <button
                  type="button"
                  aria-pressed={atmosphereView === "outdoor"}
                  onClick={() => setAtmosphereView("outdoor")}
                  className={
                    atmosphereView === "outdoor"
                      ? "inline-flex cursor-pointer items-center gap-1 rounded-md bg-[#18181B] px-2 py-1 text-[11px] font-semibold text-[#FCFBF8]"
                      : "inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#52525B] hover:text-[#18181B]"
                  }
                >
                  <Trees className="h-3 w-3" aria-hidden="true" />
                  <span>Outdoor</span>
                </button>
                <button
                  type="button"
                  aria-pressed={atmosphereView === "indoor"}
                  onClick={() => setAtmosphereView("indoor")}
                  className={
                    atmosphereView === "indoor"
                      ? "inline-flex cursor-pointer items-center gap-1 rounded-md bg-[#0F6E6E] px-2 py-1 text-[11px] font-semibold text-[#FCFBF8]"
                      : "inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#52525B] hover:text-[#18181B]"
                  }
                >
                  <Home className="h-3 w-3" aria-hidden="true" />
                  <span>Inside Plan</span>
                </button>
              </div>

              <div
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${style.pillClass}`}
              >
                <BandIcon band={current.band} />
                <span>{current.categoryLabel}</span>
              </div>
            </div>
          </div>

          {/* Hero AQI Metric + Summary */}
          <div className="mt-4 grid gap-4 border-t border-[#E5E0D5] pt-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex items-baseline gap-2.5 pr-4 sm:border-r sm:border-[#E5E0D5]">
              <CountUp
                to={current.usAqi}
                className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-[#18181B] sm:text-5xl"
              />
              <div className="flex flex-col">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0F6E6E]">
                  US AQI
                </span>
                <span className="font-mono text-[11px] text-[#52525B]">
                  EPA Scale
                </span>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-[#27272A]">
              {current.healthSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Pollutant Strip with Radix Tooltips */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {pollutants.map((item) => (
          <Tooltip key={item.label}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="cursor-help rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] px-2.5 py-2 text-left transition-colors hover:border-[#0F6E6E]/45 hover:bg-[#ECE8DF]/75"
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
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {POLLUTANT_HINTS[item.label] ?? item.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Hairline-Divided Winter Inversion Windows */}
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

      {/* 24h Hourly Curve + Radix Scrubber + Table Toggle */}
      <HourlySmogChart
        hourly={hourly}
        strokeColor={style.strokeColor}
        cityName={location.name}
        onScrubPm25={setScrubbedPm25}
      />
    </section>
  );
}
