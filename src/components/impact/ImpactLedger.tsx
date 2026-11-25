"use client";

import { useState } from "react";
import { HelpCircle, Info, Leaf, Shield, Users } from "lucide-react";
import { CountUp } from "@/components/reactbits/CountUp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
          <h2
            id="impact-ledger-heading"
            className="text-base font-bold text-[#18181B]"
          >
            Direct Impact Ledger ({adoptedCount} active)
          </h2>
          <p className="mt-0.5 text-xs text-[#52525B]">
            Updates live from deterministic EPA/WHO factors as you adopt actions.
          </p>
        </div>

        <Button
          variant="paper"
          size="sm"
          onClick={() => setModalOpen(true)}
        >
          <Info className="h-3.5 w-3.5 text-[#0F6E6E]" aria-hidden="true" />
          <span>Methodology</span>
        </Button>
      </div>

      {/* Indoor PM2.5 Exposure Drop */}
      <div className="mt-4 rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#18181B]">
            <Shield className="h-3.5 w-3.5 text-[#0F6E6E]" aria-hidden="true" />
            Estimated Indoor PM2.5
          </span>
          <Badge tone="teal" className="tabular-nums">
            <CountUp
              to={impact.indoorReductionPercent}
              prefix="-"
              suffix="% exposure"
            />
          </Badge>
        </div>

        <div className="mt-2.5 flex items-baseline justify-between font-mono text-xs tabular-nums">
          <span className="text-[#52525B]">
            Baseline: <strong>{impact.indoorPm25Before} µg/m³</strong>
          </span>
          <span className="text-[#0F6E6E]">
            With plan:{" "}
            <strong>
              <CountUp
                to={impact.indoorPm25After}
                decimals={1}
                suffix=" µg/m³"
              />
            </strong>
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

        <div className="mt-2 flex flex-wrap items-center gap-1 font-mono text-[11px] tabular-nums text-[#52525B]">
          <span>
            Avoids ~<strong>{impact.pm25DropUgM3} µg/m³</strong> indoor PM2.5
            (≈{" "}
            <strong>
              <CountUp
                to={impact.cigaretteEquivAvoidedPerDay}
                decimals={1}
              />
            </strong>{" "}
            cig-equiv/day)
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="About cigarette-equivalence heuristic"
                className="inline-flex cursor-help items-center text-[#0F6E6E]"
              >
                <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Berkeley Earth heuristic: ~22 µg/m³ of 24h PM2.5 exposure
              approximates the particulate inhalation load of 1 cigarette/day.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Daily & Winter Emissions */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] p-3">
          <div className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#52525B]">
            <Leaf className="h-3 w-3 text-[#0F6E6E]" aria-hidden="true" />
            Daily Avoided
          </div>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#18181B]">
            <CountUp
              to={impact.dailyCo2KgSaved}
              decimals={1}
              suffix=" kg CO₂e"
            />
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
            <CountUp to={impact.winterCo2KgSaved} suffix=" kg CO₂e" />
          </p>
          <p className="font-mono text-[11px] tabular-nums text-[#52525B]">
            +{impact.winterPm25GramsAvoided.toFixed(0)} g PM2.5 curbed
          </p>
        </div>
      </div>

      {/* Community Multiplier Radix Slider */}
      <div className="mt-3 rounded-lg border border-[#B2DBD4] bg-[#E6F4F1]/55 p-3">
        <div className="flex items-center justify-between gap-2">
          <span
            id="community-multiplier-label"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#18181B]"
          >
            <Users className="h-3.5 w-3.5 text-[#0F6E6E]" aria-hidden="true" />
            Community Scale Multiplier
          </span>
          <span className="font-mono text-xs font-bold tabular-nums text-[#0F6E6E]">
            {communityHouseholds}{" "}
            {communityHouseholds === 1 ? "household" : "households"}
          </span>
        </div>

        <Slider
          id="community-multiplier-slider"
          min={1}
          max={500}
          step={1}
          value={communityHouseholds}
          onValueChange={onHouseholdsChange}
          ariaLabelledBy="community-multiplier-label"
          ariaValueText={`${communityHouseholds} households`}
          className="mt-1"
        />

        <p className="mt-1 text-xs leading-relaxed text-[#3F3F46]">
          Together over winter: avoids{" "}
          <strong className="font-mono tabular-nums text-[#18181B]">
            <CountUp
              to={impact.communityWinterCo2Tons}
              decimals={2}
              suffix=" metric tons CO₂e"
            />
          </strong>{" "}
          — equal to taking{" "}
          <strong className="font-mono tabular-nums text-[#0F6E6E]">
            <CountUp
              to={impact.equivalentCarsOffRoadWeek}
              decimals={1}
              suffix=" cars"
            />
          </strong>{" "}
          off local roads each smog week.
        </p>
      </div>

      <MethodologyModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
}
