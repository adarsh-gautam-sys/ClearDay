"use client";

import { useState } from "react";
import { Table2 } from "lucide-react";
import type { HourlyPoint } from "@/lib/schemas";

interface HourlySmogChartProps {
  hourly: HourlyPoint[];
  strokeColor: string;
  cityName: string;
}

export function HourlySmogChart({
  hourly,
  strokeColor,
  cityName,
}: HourlySmogChartProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showTable, setShowTable] = useState(false);

  const safeHourly = hourly.length > 0 ? hourly : [];
  const activeIndex = Math.min(selectedIndex, Math.max(0, safeHourly.length - 1));
  const activePoint = safeHourly[activeIndex];

  const width = 640;
  const height = 140;
  const padX = 16;
  const padY = 16;
  const maxPm25 = Math.max(50, ...safeHourly.map((p) => p.pm25));

  const coords = safeHourly.map((pt, idx) => {
    const x =
      safeHourly.length === 1
        ? width / 2
        : padX + (idx / (safeHourly.length - 1)) * (width - padX * 2);
    const y =
      height - padY - (pt.pm25 / maxPm25) * (height - padY * 2);
    return { x, y, pt };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(" ");

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1]!.x.toFixed(1)} ${height - padY} L ${coords[0]!.x.toFixed(1)} ${height - padY} Z`
      : "";

  const whoLineY =
    height - padY - Math.min(1, 15 / maxPm25) * (height - padY * 2);

  return (
    <div className="mt-4 rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#52525B]">
            24-Hour Winter PM2.5 Curve (µg/m³) — {cityName}
          </span>
          {activePoint && (
            <p
              aria-live="polite"
              className="mt-0.5 font-mono text-xs tabular-nums text-[#18181B]"
            >
              Selected: <strong>{activePoint.hourLabel}</strong> · PM2.5{" "}
              <strong>{activePoint.pm25} µg/m³</strong> · US AQI{" "}
              <strong>{activePoint.usAqi}</strong>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          aria-expanded={showTable}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#D8D2C5] bg-[#FCFBF8] px-2.5 py-1 text-xs font-medium text-[#18181B] hover:bg-[#ECE8DF]"
        >
          <Table2 className="h-3.5 w-3.5 text-[#0F6E6E]" aria-hidden="true" />
          <span>{showTable ? "Chart View" : "24h Table View"}</span>
        </button>
      </div>

      {!showTable ? (
        <div className="mt-2">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            className="h-36 w-full overflow-visible"
          >
            <line
              x1={padX}
              x2={width - padX}
              y1={whoLineY}
              y2={whoLineY}
              stroke="#0F6E6E"
              strokeDasharray="4 4"
              strokeWidth="1"
              opacity="0.55"
            />
            <text
              x={padX}
              y={Math.max(11, whoLineY - 4)}
              fontSize="9"
              fill="#0F6E6E"
              fontFamily="monospace"
            >
              WHO 24h Guideline (15 µg/m³)
            </text>

            {areaPath && (
              <path d={areaPath} fill={strokeColor} opacity="0.12" />
            )}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {coords.map((c, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <circle
                  key={c.pt.time}
                  cx={c.x}
                  cy={c.y}
                  r={isSelected ? 5 : 3}
                  fill={isSelected ? "#0F6E6E" : strokeColor}
                  stroke="#FCFBF8"
                  strokeWidth="1.5"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => setSelectedIndex(idx)}
                  className="cursor-pointer"
                />
              );
            })}
          </svg>

          {safeHourly.length > 1 && (
            <div className="mt-1.5 flex items-center gap-3">
              <label
                htmlFor="hourly-scrubber"
                className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[#52525B]"
              >
                Inspect Hour
              </label>
              <input
                id="hourly-scrubber"
                type="range"
                min={0}
                max={safeHourly.length - 1}
                step={1}
                value={activeIndex}
                aria-valuetext={
                  activePoint
                    ? `${activePoint.hourLabel}, PM2.5 ${activePoint.pm25} micrograms per cubic meter, US AQI ${activePoint.usAqi}`
                    : undefined
                }
                onChange={(e) => setSelectedIndex(Number(e.target.value))}
                className="w-full accent-[#0F6E6E]"
              />
            </div>
          )}

          <div className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-[#52525B]">
            <span>{safeHourly[0]?.hourLabel ?? "00:00"}</span>
            <span>
              {safeHourly[Math.floor(safeHourly.length / 2)]?.hourLabel ?? "12:00"}
            </span>
            <span>{safeHourly[safeHourly.length - 1]?.hourLabel ?? "23:00"}</span>
          </div>
        </div>
      ) : (
        <div className="mt-2 max-h-48 overflow-auto rounded-md border border-[#D8D2C5] bg-[#FCFBF8]">
          <table className="w-full text-left font-mono text-xs tabular-nums">
            <thead className="sticky top-0 border-b border-[#D8D2C5] bg-[#ECE8DF] text-[10px] uppercase text-[#52525B]">
              <tr>
                <th scope="col" className="px-3 py-1.5">Hour</th>
                <th scope="col" className="px-3 py-1.5">PM2.5 (µg/m³)</th>
                <th scope="col" className="px-3 py-1.5">US AQI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D5]">
              {safeHourly.map((pt) => (
                <tr key={pt.time}>
                  <td className="px-3 py-1.5 font-medium text-[#18181B]">
                    {pt.hourLabel}
                  </td>
                  <td className="px-3 py-1.5 text-[#3F3F46]">{pt.pm25}</td>
                  <td className="px-3 py-1.5 text-[#3F3F46]">{pt.usAqi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
