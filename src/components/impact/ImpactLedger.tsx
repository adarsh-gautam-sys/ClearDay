"use client";

import { useState } from "react";
import { Info, Leaf, Shield, Users } from "lucide-react";
import type { ImpactSummary } from "@/lib/impact/calculator";
import { MethodologyModal } from "./MethodologyModal";

interface ImpactLedgerProps {
  impact: ImpactSummary;
  adoptedCount: number;
  communityHouseholds: number;
  onHouseholdsChange: (count: number) => void;
}

export function ImpactLedger({
  impact,
  adoptedCount,
  communityHouseholds,
  onHouseholdsChange,
}: ImpactLedgerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const afterWidthPct =
    impact.indoorPm25Before > 0
      ? Math.max(
          4,
          Math.round((impact.indoorPm25After / impact.indoorPm25Before) * 100),
        )
      : 100;

  return (
    <section
      aria-labelledby="impact-ledger-heading"
      className="rounded-xl border border-[#D8D2C5] bg-[#FCFBF8] p-4 shadow-beautiful-md sm:p-5"
    >
      <div className="flex items-start justify-between gap-2 border-b border-[#E5E0D5] pb-3">
        <div>
          <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#52525B]">
            04 · DIRECT IMPACT LEDGER
          </span>
          <h2
            id="impact-ledger-heading"
            className="mt-0.5 text-base font-bold text-[#18181B]"
          >
            Your Adopted Choices ({adoptedCount} active)
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-[#D8D2C5] bg-[#F6F4EF] px-2.5 py-1 text-xs font-medium text-[#18181B] hover:bg-[#ECE8DF]"
        >
          <Info className="h-3.5 w-3.5 text-[#0F6E6E]" aria-hidden="true" />
          <span>Methodology</span>
        </button>
      </div>

      {/* Indoor PM2.5 Exposure Drop */}
      <div className="mt-4 rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#18181B]">
            <Shield className="h-3.5 w-3.5 text-[#0F6E6E]" aria-hidden="true" />
            Estimated Indoor PM2.5
          </span>
          <span className="rounded bg-[#E6F4F1] px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-[#0F6E6E]">
            -{impact.indoorReductionPercent}% exposure
          </span>
        </div>

        <div className="mt-2.5 flex items-baseline justify-between font-mono text-xs tabular-nums">
          <span className="text-[#52525B]">
            Baseline: <strong>{impact.indoorPm25Before} µg/m³</strong>
          </span>
          <span className="text-[#0F6E6E]">
            With plan: <strong>{impact.indoorPm25After} µg/m³</strong>
          </span>
        </div>

        <div
          aria-hidden="true"
          className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#DDD8CE]"
        >
          <div
            className="h-full rounded-full bg-[#0F6E6E] transition-all duration-300"
            style={{ width: `${afterWidthPct}%` }}
          />
        </div>

        <p className="mt-2 font-mono text-[11px] tabular-nums text-[#52525B]">
          Avoids ~<strong>{impact.pm25DropUgM3} µg/m³</strong> indoor PM2.5 (≈{" "}
          <strong>{impact.cigaretteEquivAvoidedPerDay}</strong> cig-equiv/day
          breathing load)
        </p>
      </div>

      {/* Daily & Winter Emissions */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] p-3">
          <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#52525B]">
            <Leaf className="h-3 w-3 text-[#0F6E6E]" aria-hidden="true" />
            Daily Avoided
          </div>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#18181B]">
            {impact.dailyCo2KgSaved.toFixed(1)} kg CO₂e
          </p>
          <p className="font-mono text-[11px] tabular-nums text-[#52525B]">
            +{impact.dailyPm25GramsAvoided.toFixed(1)} g PM2.5 curbed
          </p>
        </div>

        <div className="rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[#52525B]">
            90-Day Winter Total
          </div>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#18181B]">
            {impact.winterCo2KgSaved.toFixed(0)} kg CO₂e
          </p>
          <p className="font-mono text-[11px] tabular-nums text-[#52525B]">
            +{impact.winterPm25GramsAvoided.toFixed(0)} g PM2.5 curbed
          </p>
        </div>
      </div>

      {/* Community Multiplier Slider */}
      <div className="mt-3 rounded-lg border border-[#B2DBD4] bg-[#E6F4F1]/55 p-3">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="community-multiplier-slider"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#18181B]"
          >
            <Users className="h-3.5 w-3.5 text-[#0F6E6E]" aria-hidden="true" />
            Community Scale Multiplier
          </label>
          <span className="font-mono text-xs font-bold tabular-nums text-[#0F6E6E]">
            {communityHouseholds}{" "}
            {communityHouseholds === 1 ? "household" : "households"}
          </span>
        </div>

        <input
          id="community-multiplier-slider"
          type="range"
          min={1}
          max={500}
          step={1}
          value={communityHouseholds}
          onChange={(e) => onHouseholdsChange(Number(e.target.value))}
          className="mt-2 w-full accent-[#0F6E6E]"
        />

        <p className="mt-1.5 text-xs leading-relaxed text-[#3F3F46]">
          Together over winter: avoids{" "}
          <strong className="font-mono tabular-nums text-[#18181B]">
            {impact.communityWinterCo2Tons.toFixed(2)} metric tons CO₂e
          </strong>{" "}
          — equal to taking{" "}
          <strong className="font-mono tabular-nums text-[#0F6E6E]">
            {impact.equivalentCarsOffRoadWeek.toFixed(1)} cars
          </strong>{" "}
          off local roads each smog week.
        </p>
      </div>

      <MethodologyModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
}
