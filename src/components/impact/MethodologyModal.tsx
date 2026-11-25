"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BASELINE_INFILTRATION_BY_PURIFIER,
  CAR_WEEKLY_CO2_KG,
  IMPACT_FACTORS,
  PM25_PER_CIGARETTE_UG_M3,
  WINTER_SEASON_DAYS,
} from "@/lib/impact/factors";

interface MethodologyModalProps {
  open: boolean;
  onClose: () => void;
}

export function MethodologyModal({ open, onClose }: MethodologyModalProps) {
  const entries = Object.entries(IMPACT_FACTORS);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent>
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E0D5] pb-3">
          <div>
            <DialogTitle>How ClearDay Calculates Your Direct Impact</DialogTitle>
            <DialogDescription className="mt-0.5">
              Deterministic formulas and peer-reviewed environmental emission
              factors (US EPA, WHO, DEFRA, Berkeley Earth).
            </DialogDescription>
          </div>

          <DialogClose asChild>
            <Button
              variant="paper"
              size="icon"
              aria-label="Close methodology dialog"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DialogClose>
        </div>

        <div className="mt-4 space-y-4 text-xs leading-relaxed text-[#3F3F46]">
          <div className="rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] p-3">
            <h3 className="font-semibold text-[#18181B]">
              1. Deterministic Exposure Math (Zero LLM Hallucinations)
            </h3>
            <p className="mt-1">
              Indoor baseline PM2.5 starts from outdoor ambient PM2.5 ×
              infiltration ratio (
              <span className="font-mono">
                {BASELINE_INFILTRATION_BY_PURIFIER.none}
              </span>{" "}
              unfiltered,{" "}
              <span className="font-mono">
                {BASELINE_INFILTRATION_BY_PURIFIER.diy_box}
              </span>{" "}
              DIY MERV-13,{" "}
              <span className="font-mono">
                {BASELINE_INFILTRATION_BY_PURIFIER.hepa}
              </span>{" "}
              HEPA). Selected actions combine multiplicatively as{" "}
              <span className="font-mono">1 − ∏(1 − rᵢ)</span> and are capped at{" "}
              <span className="font-mono">92%</span> so estimates never exceed
              physical filtration limits.
            </p>
          </div>

          <div className="rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] p-3">
            <h3 className="font-semibold text-[#18181B]">
              2. Equivalences & Winter Scaling
            </h3>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                <strong>Cigarette equivalence heuristic:</strong> Berkeley Earth
                rule-of-thumb (
                <span className="font-mono">
                  {PM25_PER_CIGARETTE_UG_M3} µg/m³
                </span>{" "}
                24-hour PM2.5 ≈ 1 cigarette/day) for intuitive communication.
              </li>
              <li>
                <strong>Winter season window:</strong>{" "}
                <span className="font-mono">{WINTER_SEASON_DAYS}</span> peak
                inversion days.
              </li>
              <li>
                <strong>Cars-off-road equivalence:</strong> US EPA passenger car
                average (
                <span className="font-mono">
                  {CAR_WEEKLY_CO2_KG} kg CO₂/week
                </span>
                ).
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-[#18181B]">
              3. Per-Category Factors & Sources
            </h3>
            <div className="divide-y divide-[#E5E0D5] rounded-lg border border-[#E5E0D5]">
              {entries.map(([key, factor]) => (
                <div key={key} className="p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#18181B]">
                      {factor.label}
                    </span>
                    <span className="font-mono text-[10px] text-[#0F6E6E]">
                      {factor.sourceCitation}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[#52525B]">
                    {factor.methodologyNote}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
