"use client";

import { useEffect, useRef, useState } from "react";
import { Compass, MapPin, RotateCcw, Search, Sparkles, Wind } from "lucide-react";
import { CITY_PRESETS } from "@/lib/air-quality/presets";
import type { AirQualitySnapshot, LocationInfo } from "@/lib/schemas";

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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setDropdownOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/air-quality?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = (await res.json()) as { results?: LocationInfo[] };
          setResults(data.results ?? []);
          setDropdownOpen(true);
        }
      } catch {
        // Ignore aborted or transient search errors
      } finally {
        setIsSearching(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

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
    <header className="border-b border-[#D8D2C5] bg-[#FCFBF8]/90 px-4 py-3 sm:px-6">
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
                <span className="rounded border border-[#D8D2C5] bg-[#ECE8DF] px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-[#52525B]">
                  WINTER SMOG BRIEF
                </span>
              </div>
              <p className="font-mono text-[11px] tabular-nums text-[#52525B]">
                {location.latitude.toFixed(2)}°N, {location.longitude.toFixed(2)}°E ·{" "}
                {airQuality.source === "open-meteo" ? "OPEN-METEO LIVE" : "OFFLINE SNAPSHOT"}
              </p>
            </div>
          </div>
        </div>

        {/* City Search + GPS + AI Mode + Reset */}
        <div className="flex flex-wrap items-center gap-2">
          <div ref={containerRef} className="relative flex-1 sm:w-64 sm:flex-none">
            <label htmlFor="city-search-input" className="sr-only">
              Search city for local air quality
            </label>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#52525B]"
              aria-hidden="true"
            />
            <input
              id="city-search-input"
              type="search"
              role="combobox"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any city (e.g. Tokyo)..."
              aria-autocomplete="list"
              aria-expanded={dropdownOpen && results.length > 0}
              aria-controls={
                dropdownOpen && results.length > 0
                  ? "city-search-listbox"
                  : undefined
              }
              className="w-full rounded-lg border border-[#D8D2C5] bg-[#F6F4EF] py-1.5 pl-8 pr-3 text-xs text-[#18181B] placeholder:text-[#71717A] shadow-beautiful-sm focus:border-[#0F6E6E]"
            />

            {dropdownOpen && (
              <div
                id="city-search-listbox"
                role="listbox"
                aria-label="Matching cities"
                className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-60 overflow-auto rounded-lg border border-[#D8D2C5] bg-[#FCFBF8] p-1 shadow-beautiful-md"
              >
                {isSearching ? (
                  <p className="px-2.5 py-2 font-mono text-xs text-[#52525B]">
                    Searching cities…
                  </p>
                ) : results.length === 0 ? (
                  <p className="px-2.5 py-2 text-xs text-[#52525B]">
                    No matching cities found.
                  </p>
                ) : (
                  results.map((item) => (
                    <button
                      key={`${item.name}-${item.latitude}-${item.longitude}`}
                      type="button"
                      role="option"
                      aria-selected={item.name === location.name}
                      onClick={() => {
                        onSelectLocation(item);
                        setQuery("");
                        setDropdownOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs text-[#18181B] hover:bg-[#ECE8DF]"
                    >
                      <span className="font-medium">
                        {item.name}, {item.country}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-[#52525B]">
                        {item.latitude.toFixed(1)}, {item.longitude.toFixed(1)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleUseGeolocation}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D2C5] bg-[#F6F4EF] px-2.5 py-1.5 text-xs font-medium text-[#18181B] shadow-beautiful-sm hover:bg-[#ECE8DF]"
          >
            <Compass className="h-3.5 w-3.5 text-[#0F6E6E]" aria-hidden="true" />
            <span>Use GPS</span>
          </button>

          <span
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D2C5] bg-[#ECE8DF] px-2.5 py-1.5 font-mono text-[11px] font-medium text-[#18181B]"
            title={
              aiMode === "gemini"
                ? "Powered by live Google Gemini Flash"
                : "Running deterministic guided offline intelligence (add GEMINI_API_KEY for live Gemini)"
            }
          >
            <Sparkles className="h-3 w-3 text-[#0F6E6E]" aria-hidden="true" />
            <span>{aiMode === "gemini" ? "GEMINI LIVE" : "GUIDED OFFLINE"}</span>
          </span>

          <button
            type="button"
            onClick={onResetAll}
            className="inline-flex items-center gap-1 rounded-lg border border-[#D8D2C5] bg-[#FCFBF8] px-2.5 py-1.5 text-xs font-medium text-[#52525B] hover:bg-[#ECE8DF] hover:text-[#18181B]"
            title="Reset profile and adopted actions"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
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
            <button
              key={preset.id}
              type="button"
              disabled={isLoadingAir}
              onClick={() => onSelectLocation(preset.location)}
              aria-pressed={isActive}
              className={
                isActive
                  ? "rounded-md border border-[#0F6E6E] bg-[#0F6E6E] px-2.5 py-1 text-xs font-semibold text-[#FCFBF8] shadow-beautiful-sm"
                  : "rounded-md border border-[#D8D2C5] bg-[#F6F4EF] px-2.5 py-1 text-xs font-medium text-[#3F3F46] hover:bg-[#ECE8DF]"
              }
            >
              {preset.location.name}
            </button>
          );
        })}
        {geoMessage && (
          <span className="ml-2 font-mono text-[11px] text-[#9A3412]">
            {geoMessage}
          </span>
        )}
      </div>
    </header>
  );
}
