"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { calculateImpact } from "@/lib/impact/calculator";
import {
  DEFAULT_PROFILE,
  HouseholdProfileSchema,
  type ActionPlanResponse,
  type AirQualitySnapshot,
  type HouseholdProfile,
  type ImpactCategory,
  type LocationInfo,
} from "@/lib/schemas";
import { AirBriefingCard } from "./air/AirBriefingCard";
import { AgentStatus, type AgentPhase } from "./copilot/AgentStatus";
import { SmogCopilot } from "./copilot/SmogCopilot";
import { ImpactLedger } from "./impact/ImpactLedger";
import { ActionPlanTabs } from "./plan/ActionPlanTabs";
import { HouseholdProfileBar } from "./profile/HouseholdProfileBar";
import { FramedShell } from "./shell/FramedShell";
import { TopTelemetryRail } from "./shell/TopTelemetryRail";

const STORAGE_KEY = "clearday_state_v1";

interface ClearDayWorkspaceProps {
  initialAirQuality: AirQualitySnapshot;
  initialPlan: ActionPlanResponse;
}

function collectPlanItemIds(plan: ActionPlanResponse): Set<string> {
  return new Set([
    ...plan.routine.map((r) => r.id),
    ...plan.indoorHacks.map((h) => h.id),
    ...plan.sustainableAlternatives.map((s) => s.id),
  ]);
}

function defaultAdoptedForPlan(plan: ActionPlanResponse): string[] {
  return [plan.routine[0]?.id, plan.indoorHacks[0]?.id].filter(
    (x): x is string => Boolean(x),
  );
}

export function ClearDayWorkspace({
  initialAirQuality,
  initialPlan,
}: ClearDayWorkspaceProps) {
  const [airQuality, setAirQuality] =
    useState<AirQualitySnapshot>(initialAirQuality);
  const [plan, setPlan] = useState<ActionPlanResponse>(initialPlan);
  const [profile, setProfile] = useState<HouseholdProfile>(DEFAULT_PROFILE);
  const [adoptedIds, setAdoptedIds] = useState<string[]>(() =>
    defaultAdoptedForPlan(initialPlan),
  );
  const [communityHouseholds, setCommunityHouseholds] = useState(25);
  const [airPhase, setAirPhase] = useState<AgentPhase>("idle");
  const [planPhase, setPlanPhase] = useState<AgentPhase>("idle");
  const [statusError, setStatusError] = useState<string | null>(null);

  const airAbortRef = useRef<AbortController | null>(null);
  const planAbortRef = useRef<AbortController | null>(null);
  const hasHydratedRef = useRef(false);

  const refreshPlan = useCallback(
    async (nextAir: AirQualitySnapshot, nextProfile: HouseholdProfile) => {
      planAbortRef.current?.abort();
      const controller = new AbortController();
      planAbortRef.current = controller;

      setPlanPhase("reasoning");
      setStatusError(null);

      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ airQuality: nextAir, profile: nextProfile }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Plan request failed (${res.status})`);
        }
        const nextPlan = (await res.json()) as ActionPlanResponse;
        setPlan(nextPlan);
        setAdoptedIds((prev) => {
          const validIds = collectPlanItemIds(nextPlan);
          const preserved = prev.filter((id) => validIds.has(id));
          return preserved.length > 0
            ? preserved
            : defaultAdoptedForPlan(nextPlan);
        });
        setPlanPhase("done");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPlanPhase("error");
        setStatusError("Could not refresh action plan; showing prior guidance.");
      }
    },
    [],
  );

  // Restore saved preferences once on mount; re-sync plan if profile changed.
  useEffect(() => {
    let restoredDiffers = false;
    let restoredProfile = DEFAULT_PROFILE;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          profile?: unknown;
          adoptedIds?: unknown;
          communityHouseholds?: unknown;
        };
        const parsedProfile = HouseholdProfileSchema.safeParse(saved.profile);
        if (parsedProfile.success) {
          restoredProfile = parsedProfile.data;
          setProfile(parsedProfile.data);
          restoredDiffers =
            JSON.stringify(parsedProfile.data) !==
            JSON.stringify(DEFAULT_PROFILE);
        }
        if (Array.isArray(saved.adoptedIds)) {
          setAdoptedIds(
            saved.adoptedIds
              .filter((x): x is string => typeof x === "string")
              .slice(0, 24),
          );
        }
        if (
          typeof saved.communityHouseholds === "number" &&
          Number.isFinite(saved.communityHouseholds)
        ) {
          setCommunityHouseholds(
            Math.max(1, Math.min(500, Math.round(saved.communityHouseholds))),
          );
        }
      }
    } catch {
      // Ignore malformed or blocked localStorage
    } finally {
      hasHydratedRef.current = true;
    }

    if (restoredDiffers) {
      void refreshPlan(initialAirQuality, restoredProfile);
    }
  }, [initialAirQuality, refreshPlan]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ profile, adoptedIds, communityHouseholds }),
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [profile, adoptedIds, communityHouseholds]);

  // Abort any in-flight telemetry or plan requests cleanly on unmount.
  useEffect(() => {
    return () => {
      airAbortRef.current?.abort();
      planAbortRef.current?.abort();
    };
  }, []);

  async function handleSelectLocation(loc: LocationInfo) {
    airAbortRef.current?.abort();
    const controller = new AbortController();
    airAbortRef.current = controller;

    setAirPhase("retrieving");
    setStatusError(null);

    try {
      const url = new URL("/api/air-quality", window.location.origin);
      url.searchParams.set("lat", String(loc.latitude));
      url.searchParams.set("lon", String(loc.longitude));
      url.searchParams.set("name", loc.name);
      url.searchParams.set("country", loc.country);
      url.searchParams.set("timezone", loc.timezone);

      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Telemetry error (${res.status})`);
      }
      const nextAir = (await res.json()) as AirQualitySnapshot;
      setAirQuality(nextAir);
      setAirPhase("done");
      await refreshPlan(nextAir, profile);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setAirPhase("error");
      setStatusError("Unable to load telemetry for that location right now.");
    }
  }

  function handleProfileChange(nextProfile: HouseholdProfile) {
    setProfile(nextProfile);
    if (nextProfile.scope === "community" && communityHouseholds < 10) {
      setCommunityHouseholds(50);
    }
    void refreshPlan(airQuality, nextProfile);
  }

  function handleToggleAdopt(id: string) {
    setAdoptedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function handleResetAll() {
    setProfile(DEFAULT_PROFILE);
    setCommunityHouseholds(25);
    setAdoptedIds(defaultAdoptedForPlan(plan));
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    void refreshPlan(airQuality, DEFAULT_PROFILE);
  }

  const { adoptedCategories, adoptedTitles } = useMemo(() => {
    const allItems = [
      ...plan.routine.map((r) => ({
        id: r.id,
        title: r.title,
        impactCategory: r.impactCategory,
      })),
      ...plan.indoorHacks.map((h) => ({
        id: h.id,
        title: h.title,
        impactCategory: h.impactCategory,
      })),
      ...plan.sustainableAlternatives.map((s) => ({
        id: s.id,
        title: s.title,
        impactCategory: s.impactCategory,
      })),
    ];

    const selected = allItems.filter((item) => adoptedIds.includes(item.id));
    const cats: ImpactCategory[] = selected.map((s) => s.impactCategory);
    const titles: string[] = selected.map((s) => s.title);
    return { adoptedCategories: cats, adoptedTitles: titles };
  }, [plan, adoptedIds]);

  const currentPm25 = airQuality.current.pm25;
  const purifier = profile.purifier;

  const impact = useMemo(
    () =>
      calculateImpact({
        currentPm25,
        purifier,
        selectedCategories: adoptedCategories,
        communityHouseholds,
      }),
    [currentPm25, purifier, adoptedCategories, communityHouseholds],
  );

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

        {(airPhase === "retrieving" || statusError) && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D8D2C5] bg-[#F6F4EF] px-4 py-2 sm:px-6">
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

        {/* Technical Split-Screen Workspace (MengTo split-layout-technical) */}
        <main
          id="main-content"
          className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.32fr)_minmax(340px,0.95fr)] lg:gap-6"
        >
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
              onRegeneratePlan={() => void refreshPlan(airQuality, profile)}
            />
          </div>

          <aside
            aria-label="Impact ledger and Smog Copilot"
            className="min-w-0 space-y-5 lg:border-l lg:border-[#D8D2C5] lg:pl-6"
          >
            <ImpactLedger
              impact={impact}
              adoptedCount={adoptedCategories.length}
              communityHouseholds={communityHouseholds}
              onHouseholdsChange={setCommunityHouseholds}
            />
            <SmogCopilot
              airQuality={airQuality}
              profile={profile}
              adoptedTitles={adoptedTitles}
            />
          </aside>
        </main>
      </FramedShell>
    </TooltipProvider>
  );
}
