"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
            <h2
              id="action-plan-heading"
              className="text-base font-bold leading-snug text-[#18181B]"
            >
              {plan.headline}
            </h2>
            <AgentStatus
              phase={planPhase}
              label="Synthesizing tailored smog plan…"
            />
          </div>
        </div>

        <Button
          variant="paper"
          onClick={onRegeneratePlan}
          disabled={planPhase === "reasoning"}
        >
          <RefreshCw className="h-3.5 w-3.5 text-[#0F6E6E]" aria-hidden="true" />
          <span>Refresh Plan</span>
        </Button>
      </div>

      {/* Radix Accessible Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as PlanTabKey)}
        className="mt-3"
      >
        <TabsList aria-label="Action plan categories">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              <span className="font-mono text-[10px] text-[#0F6E6E]">
                {tab.marker}
              </span>
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="routine" className="space-y-3">
          {plan.routine.map((step, idx) => (
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
        </TabsContent>

        <TabsContent value="indoor" className="space-y-3">
          {plan.indoorHacks.map((hack, idx) => (
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
        </TabsContent>

        <TabsContent value="swaps" className="space-y-3">
          {plan.sustainableAlternatives.map((swap, idx) => (
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
        </TabsContent>
      </Tabs>

      {/* Community Advisory Share Draft */}
      {(scope === "community" || activeTab === "swaps") && (
        <div className="mt-4 rounded-xl border border-[#B2DBD4] bg-[#E6F4F1]/65 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#0F6E6E]">
              SHAREABLE COMMUNITY ADVISORY DRAFT
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAdvisory}
              className="border-[#0F6E6E]/30 text-[#0F6E6E]"
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
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#18181B]">
            {plan.communityAdvisoryDraft}
          </p>
        </div>
      )}
    </section>
  );
}
