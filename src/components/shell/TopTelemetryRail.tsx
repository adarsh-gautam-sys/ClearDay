"use client";

import { useState } from "react";
import { Compass, MapPin, RotateCcw, Sparkles, Wind } from "lucide-react";
import { ShinyText } from "@/components/reactbits/ShinyText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CITY_PRESETS } from "@/lib/air-quality/presets";
import type { AirQualitySnapshot, LocationInfo } from "@/lib/schemas";
import { CitySearchCombobox } from "./CitySearchCombobox";

interface TopTelemetryRailProps {
  airQuality: AirQualitySnapshot;
  aiMode: "gemini" | "fallback";
  isLoadingAir: boolean;
  onSelectLocation: (loc: LocationInfo) => void;
  onResetAll: () => void;
}

export function TopTelemetryRail({
  airQuality,
  aiMode,
  isLoadingAir,
  onSelectLocation,
  onResetAll,
}: TopTelemetryRailProps) {
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  function handleUseGeolocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoMessage("Geolocation is unavailable in this browser.");
      return;
    }
    setGeoMessage("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoMessage(null);
        onSelectLocation({
          name: "My Location",
          country: "GPS",
          latitude: Math.round(pos.coords.latitude * 1000) / 1000,
          longitude: Math.round(pos.coords.longitude * 1000) / 1000,
          timezone: "auto",
        });
      },
      () => {
        setGeoMessage("Location access declined — choose a city below.");
      },
      { timeout: 6000 },
    );
  }

  const { location } = airQuality;

  return (
    <header className="border-b border-[#D8D2C5] bg-[#FCFBF8]/92 px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        {/* Brand + Telemetry Coordinates */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#0F6E6E]/25 bg-[#0F6E6E] text-[#FCFBF8] shadow-beautiful-sm">
              <Wind className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-[#18181B]">
                  ClearDay
                </span>
                <Badge tone="neutral">WINTER SMOG BRIEF</Badge>
              </div>
              <p className="font-mono text-[11px] tabular-nums text-[#52525B]">
                {Math.abs(location.latitude).toFixed(2)}°
                {location.latitude >= 0 ? "N" : "S"},{" "}
                {Math.abs(location.longitude).toFixed(2)}°
                {location.longitude >= 0 ? "E" : "W"} ·{" "}
                {airQuality.source === "open-meteo"
                  ? "OPEN-METEO LIVE"
                  : "OFFLINE SNAPSHOT"}
              </p>
            </div>
          </div>
        </div>

        {/* City Search + GPS + AI Mode + Reset */}
        <div className="flex flex-wrap items-center gap-2">
          <CitySearchCombobox onSelectLocation={onSelectLocation} />

          <Button variant="paper" onClick={handleUseGeolocation}>
            <Compass className="h-3.5 w-3.5 text-[#0F6E6E]" aria-hidden="true" />
            <span>Use GPS</span>
          </Button>

          <span
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D8D2C5] bg-[#ECE8DF] px-2.5 font-mono text-[11px] font-medium text-[#18181B]"
            title={
              aiMode === "gemini"
                ? "Powered by live Google Gemini"
                : "Running deterministic guided offline intelligence"
            }
          >
            <Sparkles className="h-3 w-3 text-[#0F6E6E]" aria-hidden="true" />
            {aiMode === "gemini" ? (
              <ShinyText text="GEMINI LIVE" />
            ) : (
              <span>GUIDED OFFLINE</span>
            )}
          </span>

          <Button
            variant="outline"
            onClick={onResetAll}
            title="Reset profile and adopted actions"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </Button>
        </div>
      </div>

      {/* Quick Winter Smog City Presets */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#52525B]">
          <MapPin className="h-3 w-3 text-[#0F6E6E]" aria-hidden="true" />
          Presets:
        </span>
        {CITY_PRESETS.map((preset) => {
          const isActive =
            preset.location.name.toLowerCase() === location.name.toLowerCase();
          return (
            <Button
              key={preset.id}
              variant={isActive ? "default" : "paper"}
              size="sm"
              disabled={isLoadingAir}
              onClick={() => onSelectLocation(preset.location)}
              aria-pressed={isActive}
            >
              {preset.location.name}
            </Button>
          );
        })}
        {geoMessage && (
          <span
            role="status"
            aria-live="polite"
            className="ml-2 font-mono text-[11px] text-[#9A3412]"
          >
            {geoMessage}
          </span>
        )}
      </div>
    </header>
  );
}
