"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import type { LocationInfo } from "@/lib/schemas";

interface CitySearchComboboxProps {
  onSelectLocation: (loc: LocationInfo) => void;
}

/**
 * WAI-ARIA 1.2 accessible city autocomplete combobox backed by /api/air-quality?q=.
 */
export function CitySearchCombobox({
  onSelectLocation,
}: CitySearchComboboxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setDropdownOpen(false);
      setActiveIndex(-1);
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
          const next = data.results ?? [];
          setResults(next);
          setActiveIndex(next.length > 0 ? 0 : -1);
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
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function commitSelection(item: LocationInfo) {
    onSelectLocation(item);
    setQuery("");
    setDropdownOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen || results.length === 0) {
      if (event.key === "ArrowDown" && results.length > 0) {
        event.preventDefault();
        setDropdownOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % results.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((prev) =>
          prev <= 0 ? results.length - 1 : prev - 1,
        );
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(results.length - 1);
        break;
      case "Enter": {
        const chosen = results[activeIndex] ?? results[0];
        if (chosen) {
          event.preventDefault();
          commitSelection(chosen);
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        setDropdownOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  const activeOptionId =
    dropdownOpen && activeIndex >= 0 && results[activeIndex]
      ? `city-option-${activeIndex}`
      : undefined;

  return (
    <div ref={containerRef} className="relative w-full sm:w-64 sm:flex-none">
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
        onKeyDown={handleKeyDown}
        placeholder="Search any city (e.g. Tokyo)..."
        aria-autocomplete="list"
        aria-expanded={dropdownOpen && results.length > 0}
        aria-controls={
          dropdownOpen && results.length > 0
            ? "city-search-listbox"
            : undefined
        }
        aria-activedescendant={activeOptionId}
        className="h-8 w-full rounded-lg border border-[#D8D2C5] bg-[#F6F4EF] pl-8 pr-3 text-xs text-[#18181B] placeholder:text-[#52525B] shadow-beautiful-sm focus:border-[#0F6E6E]"
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
            results.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={`${item.name}-${item.latitude}-${item.longitude}`}
                  id={`city-option-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => commitSelection(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={
                    isSelected
                      ? "flex w-full cursor-pointer items-center justify-between rounded-md bg-[#ECE8DF] px-2.5 py-1.5 text-left text-xs text-[#18181B]"
                      : "flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs text-[#18181B] hover:bg-[#ECE8DF]"
                  }
                >
                  <span className="font-medium">
                    {item.name}, {item.country}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-[#52525B]">
                    {item.latitude.toFixed(1)}, {item.longitude.toFixed(1)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
