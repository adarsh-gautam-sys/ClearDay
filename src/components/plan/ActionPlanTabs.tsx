"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import type { ActionPlanResponse, ScopeMode } from "@/lib/schemas";
import { AgentStatus, type AgentPhase } from "../copilot/AgentStatus";
import { ActionCard } from "./ActionCard";

type PlanTabKey = "routine" | "indoor" | "swaps";

interface ActionPlanTabsProps {
  plan: ActionPlanResponse;
  scope: ScopeMode;
  adoptedIds: string[];
  planPhase: AgentPhase;
  onToggleAdopt: (id: string) => void;
  onRegeneratePlan: () => void;
}

const TABS: ReadonlyArray<{ key: PlanTabKey; marker: string; label: string }> = [
  { key: "routine", marker: "01", label: "Daily Routine" },
  { key: "indoor", marker: "02", label: "Indoor Hacks" },
  { key: "swaps", marker: "03", label: "Sustainable Swaps" },
];

export function ActionPlanTabs({
  plan,
  scope,
  adoptedIds,
  planPhase,
  onToggleAdopt,
  onRegeneratePlan,
}: ActionPlanTabsProps) {
  const [activeTab, setActiveTab] = useState<PlanTabKey>("routine");
  const [copied, setCopied] = useState(false);

  async function handleCopyAdvisory() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(plan.communityAdvisoryDraft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard permission denial
    }
  }

  return (
    <section
      aria-labelledby="action-plan-heading"
      className="rounded-xl border border-[#D8D2C5] bg-[#FCFBF8] p-4 shadow-beautiful-md sm:p-5"
    >
      {/* Plan Headline & Status */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E0D5] pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#52525B]">
              TAILORED ACTION PLAN
            </span>
            <AgentStatus phase={planPhase} label="Synthesizing tailored smog plan…" />
          </div>
          <h2
            id="action-plan-heading"
            className="mt-1 text-base font-semibold leading-snug text-[#18181B]"
          >
            {plan.headline}
          </h2>
        </div>

        <button
          type="button"
          onClick={onRegeneratePlan}
          disabled={planPhase === "reasoning"}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8D2C5] bg-[#F6F4EF] px-2.5 py-1.5 text-xs font-medium text-[#18181B] shadow-beautiful-sm hover:bg-[#ECE8DF] disabled:opacity-60"
        >
          <RefreshCw className="h-3.5 w-3.5 text-[#0F6E6E]" aria-hidden="true" />
          <span>Refresh Plan</span>
        </button>
      </div>

      {/* Tablist */}
      <div
        role="tablist"
        aria-label="Action plan categories"
        className="mt-3 grid grid-cols-3 gap-1.5 rounded-lg border border-[#D8D2C5] bg-[#ECE8DF] p-1"
      >
        {TABS.map((tab, idx) => {
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={isSelected}
              aria-controls={`panel-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  const next = TABS[(idx + 1) % TABS.length]!;
                  setActiveTab(next.key);
                } else if (e.key === "ArrowLeft") {
                  const prev = TABS[(idx - 1 + TABS.length) % TABS.length]!;
                  setActiveTab(prev.key);
                }
              }}
              className={
                isSelected
                  ? "flex flex-col gap-0.5 rounded-md bg-[#FCFBF8] px-2.5 py-2 text-left text-[11px] font-semibold leading-tight text-[#18181B] shadow-beautiful-sm sm:flex-row sm:items-center sm:gap-1.5 sm:px-3 sm:text-xs"
                  : "flex flex-col gap-0.5 rounded-md px-2.5 py-2 text-left text-[11px] font-medium leading-tight text-[#52525B] hover:text-[#18181B] sm:flex-row sm:items-center sm:gap-1.5 sm:px-3 sm:text-xs"
              }
            >
              <span className="font-mono text-[10px] text-[#0F6E6E]">
                {tab.marker}
              </span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel */}
      <div
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className="mt-4 space-y-3"
      >
        {activeTab === "routine" &&
          plan.routine.map((step, idx) => (
            <ActionCard
              key={step.id}
              id={step.id}
              marker={`01.${idx + 1}`}
              title={step.title}
              subtitle={step.timeWindow}
              detail={step.detail}
              whyItHelps={step.whyItHelps}
              impactCategory={step.impactCategory}
              costTier={step.costTier}
              adopted={adoptedIds.includes(step.id)}
              onToggleAdopt={onToggleAdopt}
            />
          ))}

        {activeTab === "indoor" &&
          plan.indoorHacks.map((hack, idx) => (
            <ActionCard
              key={hack.id}
              id={hack.id}
              marker={`02.${idx + 1}`}
              title={hack.title}
              subtitle="INDOOR PROTECTION"
              detail={hack.steps[0] ?? hack.whyItHelps}
              steps={hack.steps}
              setupMinutes={hack.setupMinutes}
              whyItHelps={hack.whyItHelps}
              impactCategory={hack.impactCategory}
              costTier={hack.costTier}
              adopted={adoptedIds.includes(hack.id)}
              onToggleAdopt={onToggleAdopt}
            />
          ))}

        {activeTab === "swaps" &&
          plan.sustainableAlternatives.map((swap, idx) => (
            <ActionCard
              key={swap.id}
              id={swap.id}
              marker={`03.${idx + 1}`}
              title={swap.title}
              subtitle={`REPLACES: ${swap.replaces.toUpperCase()}`}
              detail={swap.detail}
              communityAngle={swap.communityAngle}
              whyItHelps="Cuts source emissions before winter inversion caps trap exhaust at neighborhood height."
              impactCategory={swap.impactCategory}
              costTier={swap.costTier}
              adopted={adoptedIds.includes(swap.id)}
              onToggleAdopt={onToggleAdopt}
            />
          ))}
      </div>

      {/* Community Advisory Share Draft (always visible in Community mode or Tab 03) */}
      {(scope === "community" || activeTab === "swaps") && (
        <div className="mt-4 rounded-xl border border-[#B2DBD4] bg-[#E6F4F1]/65 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#0F6E6E]">
              SHAREABLE COMMUNITY ADVISORY DRAFT
            </span>
            <button
              type="button"
              onClick={handleCopyAdvisory}
              className="inline-flex items-center gap-1 rounded-md border border-[#0F6E6E]/30 bg-[#FCFBF8] px-2.5 py-1 text-xs font-semibold text-[#0F6E6E] hover:bg-[#FCFBF8]/80"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy Notice</span>
                </>
              )}
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#18181B]">
            {plan.communityAdvisoryDraft}
          </p>
        </div>
      )}
    </section>
  );
}
