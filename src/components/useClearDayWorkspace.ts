"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { AgentPhase } from "./copilot/AgentStatus";

const STORAGE_KEY = "clearday_state_v1";

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

/**
 * Coordinates workspace persistence, abortable live telemetry/plan fetches,
 * and deterministic exposure/emissions calculations for ClearDayWorkspace.
 */
export function useClearDayWorkspace(
  initialAirQuality: AirQualitySnapshot,
  initialPlan: ActionPlanResponse,
) {
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

  // Restore saved preferences once on mount; re-sync plan if profile differs.
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
      // Ignore malformed or restricted localStorage
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

  useEffect(() => {
    return () => {
      airAbortRef.current?.abort();
      planAbortRef.current?.abort();
    };
  }, []);

  const handleSelectLocation = useCallback(
    async (loc: LocationInfo) => {
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
    },
    [profile, refreshPlan],
  );

  const handleProfileChange = useCallback(
    (nextProfile: HouseholdProfile) => {
      setProfile(nextProfile);
      if (nextProfile.scope === "community" && communityHouseholds < 10) {
        setCommunityHouseholds(50);
      }
      void refreshPlan(airQuality, nextProfile);
    },
    [airQuality, communityHouseholds, refreshPlan],
  );

  const handleToggleAdopt = useCallback((id: string) => {
    setAdoptedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const handleResetAll = useCallback(() => {
    setProfile(DEFAULT_PROFILE);
    setCommunityHouseholds(25);
    setAdoptedIds(defaultAdoptedForPlan(plan));
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    void refreshPlan(airQuality, DEFAULT_PROFILE);
  }, [airQuality, plan, refreshPlan]);

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
    return {
      adoptedCategories: selected.map((s) => s.impactCategory) as ImpactCategory[],
      adoptedTitles: selected.map((s) => s.title),
    };
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

  return {
    airQuality,
    plan,
    profile,
    adoptedIds,
    adoptedCount: adoptedCategories.length,
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
    regeneratePlan: () => void refreshPlan(airQuality, profile),
  };
}
