"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock, Plus } from "lucide-react";
import { SpotlightCard } from "@/components/reactbits/SpotlightCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IMPACT_FACTORS } from "@/lib/impact/factors";
import type { CostTier, ImpactCategory } from "@/lib/schemas";
import { COST_TIER_STYLE } from "@/lib/ui/aqiTheme";

interface ActionCardProps {
  id: string;
  marker: string;
  title: string;
  subtitle: string;
  detail: string;
  whyItHelps: string;
  impactCategory: ImpactCategory;
  costTier: CostTier;
  steps?: string[];
  setupMinutes?: number;
  communityAngle?: string;
  adopted: boolean;
  onToggleAdopt: (id: string) => void;
}

export function ActionCard({
  id,
  marker,
  title,
  subtitle,
  detail,
  whyItHelps,
  impactCategory,
  costTier,
  steps,
  setupMinutes,
  communityAngle,
  adopted,
  onToggleAdopt,
}: ActionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const factor = IMPACT_FACTORS[impactCategory];
  const cost = COST_TIER_STYLE[costTier];

  const impactChips: string[] = [];
  if (factor.indoorPm25ReductionFraction > 0) {
    impactChips.push(
      `-${Math.round(factor.indoorPm25ReductionFraction * 100)}% indoor PM2.5`,
    );
  }
  if (factor.dailyCo2KgSaved > 0) {
    impactChips.push(`-${factor.dailyCo2KgSaved.toFixed(1)} kg CO₂e/day`);
  }
  if (factor.dailyPm25GramsAvoided > 0) {
    impactChips.push(`-${factor.dailyPm25GramsAvoided.toFixed(1)} g PM2.5/day`);
  }

  return (
    <SpotlightCard
      className={
        adopted
          ? "rounded-xl border border-[#0F6E6E] bg-[#FCFBF8] p-4 shadow-beautiful-md transition-colors"
          : "rounded-xl border border-[#D8D2C5] bg-[#FCFBF8] p-4 shadow-beautiful-sm transition-colors hover:border-[#B5AE9E]"
      }
    >
      <article>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {/* Top Mono Metadata Row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-medium text-[#52525B]">
                {marker}
              </span>
              <span className="font-mono text-[11px] font-medium text-[#0F6E6E]">
                {subtitle}
              </span>
              <span
                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium ${cost.className}`}
              >
                {cost.label}
              </span>
              {setupMinutes !== undefined && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#52525B]">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {setupMinutes} min
                </span>
              )}
            </div>

            <h3 className="mt-1.5 text-sm font-bold leading-snug text-[#18181B] sm:text-base">
              {title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#3F3F46] sm:text-sm">
              {detail}
            </p>

            {/* Direct Impact Explanation */}
            <div className="mt-2.5 rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] px-3 py-2">
              <p className="text-xs leading-relaxed text-[#3F3F46]">
                <strong className="font-semibold text-[#18181B]">
                  Direct impact:{" "}
                </strong>
                {whyItHelps}
              </p>
              {communityAngle && (
                <p className="mt-1 text-xs leading-relaxed text-[#0F6E6E]">
                  <strong>Community multiplier:</strong> {communityAngle}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {impactChips.map((chip) => (
                  <Badge key={chip} tone="teal" className="tabular-nums">
                    {chip}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Expandable Steps for Indoor Hacks */}
            {steps && steps.length > 0 && (
              <div className="mt-2">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((prev) => !prev)}
                  className="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] font-semibold text-[#0F6E6E] hover:underline"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                      Hide {steps.length} setup steps
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      Show {steps.length} setup steps
                    </>
                  )}
                </button>
                {expanded && (
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-[#3F3F46]">
                    {steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>

          {/* Adopt Action Toggle */}
          <Button
            variant={adopted ? "default" : "paper"}
            aria-pressed={adopted}
            onClick={() => onToggleAdopt(id)}
            className="shrink-0"
          >
            {adopted ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Adopted</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Adopt Today</span>
              </>
            )}
          </Button>
        </div>
      </article>
    </SpotlightCard>
  );
}
