"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { ActionPlanResponse, AirQualitySnapshot } from "@/lib/schemas";
import { AirBriefingCard } from "./air/AirBriefingCard";
import { AgentStatus } from "./copilot/AgentStatus";
import { SmogCopilot } from "./copilot/SmogCopilot";
import { ImpactLedger } from "./impact/ImpactLedger";
import { ActionPlanTabs } from "./plan/ActionPlanTabs";
import { HouseholdProfileBar } from "./profile/HouseholdProfileBar";
import { FramedShell } from "./shell/FramedShell";
import { TopTelemetryRail } from "./shell/TopTelemetryRail";
import { useClearDayWorkspace } from "./useClearDayWorkspace";

interface ClearDayWorkspaceProps {
  initialAirQuality: AirQualitySnapshot;
  initialPlan: ActionPlanResponse;
}

export function ClearDayWorkspace({
  initialAirQuality,
  initialPlan,
}: ClearDayWorkspaceProps) {
  const {
    airQuality,
    plan,
    profile,
    adoptedIds,
    adoptedCount,
    adoptedTitles,
    communityHouseholds,
    airPhase,
    planPhase,
    statusError,
    impact,
    setCommunityHouseholds,
    handleSelectLocation,
    handleProfileChange,
    handleToggleAdopt,
    handleResetAll,
    regeneratePlan,
  } = useClearDayWorkspace(initialAirQuality, initialPlan);

  return (
    <TooltipProvider delayDuration={200}>
      <FramedShell>
        <TopTelemetryRail
          airQuality={airQuality}
          aiMode={plan.mode}
          isLoadingAir={airPhase === "retrieving"}
          onSelectLocation={handleSelectLocation}
          onResetAll={handleResetAll}
        />

        <HouseholdProfileBar profile={profile} onChange={handleProfileChange} />

        {/* Technical Split-Screen Workspace (MengTo split-layout-technical) */}
        <main id="main-content" className="p-4 sm:p-6">
          {(airPhase === "retrieving" || statusError) && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#D8D2C5] bg-[#F6F4EF] px-4 py-2">
              <AgentStatus
                phase={airPhase}
                label="Fetching local air telemetry…"
              />
              {statusError && (
                <p role="alert" className="text-xs font-medium text-[#9A3412]">
                  {statusError}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.32fr)_minmax(340px,0.95fr)] lg:gap-6">
            <div className="min-w-0 space-y-5">
              <AirBriefingCard
                airQuality={airQuality}
                indoorPm25After={impact.indoorPm25After}
              />
              <ActionPlanTabs
                plan={plan}
                scope={profile.scope}
                adoptedIds={adoptedIds}
                planPhase={planPhase}
                onToggleAdopt={handleToggleAdopt}
                onRegeneratePlan={regeneratePlan}
              />
            </div>

            <aside
              aria-label="Impact ledger and Smog Copilot"
              className="min-w-0 space-y-5 lg:border-l lg:border-[#D8D2C5] lg:pl-6"
            >
              <ImpactLedger
                impact={impact}
                adoptedCount={adoptedCount}
                communityHouseholds={communityHouseholds}
                onHouseholdsChange={setCommunityHouseholds}
              />
              <SmogCopilot
                airQuality={airQuality}
                profile={profile}
                adoptedTitles={adoptedTitles}
              />
            </aside>
          </div>
        </main>

        <footer className="border-t border-[#D8D2C5] bg-[#FCFBF8]/80 px-4 py-3 font-mono text-[11px] text-[#52525B] sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              ClearDay · Telemetry via Open-Meteo · Deterministic factors from US EPA, WHO, DEFRA &amp; Berkeley Earth.
            </span>
            <span>Environmental preparedness guidance only — not medical diagnosis.</span>
          </div>
        </footer>
      </FramedShell>
    </TooltipProvider>
  );
}
