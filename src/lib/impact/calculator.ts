import type { ImpactCategory, PurifierSetup } from "../schemas";
import {
  BASELINE_INFILTRATION_BY_PURIFIER,
  CAR_WEEKLY_CO2_KG,
  IMPACT_FACTORS,
  PM25_PER_CIGARETTE_UG_M3,
  WINTER_SEASON_DAYS,
} from "./factors";

export interface ImpactInput {
  currentPm25: number;
  purifier: PurifierSetup;
  selectedCategories: ImpactCategory[];
  communityHouseholds: number;
}

export interface ImpactSummary {
  indoorPm25Before: number;
  indoorPm25After: number;
  indoorReductionPercent: number;
  pm25DropUgM3: number;
  cigaretteEquivAvoidedPerDay: number;
  dailyCo2KgSaved: number;
  dailyPm25GramsAvoided: number;
  winterCo2KgSaved: number;
  winterPm25GramsAvoided: number;
  communityWinterCo2Tons: number;
  equivalentCarsOffRoadWeek: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Computes conservative, deterministic exposure reduction and emission savings
 * from the user's adopted action categories.
 */
export function calculateImpact(input: ImpactInput): ImpactSummary {
  const safePm25 = Number.isFinite(input.currentPm25)
    ? Math.max(0, input.currentPm25)
    : 0;
  const households = Number.isFinite(input.communityHouseholds)
    ? Math.max(1, Math.min(10000, Math.round(input.communityHouseholds)))
    : 1;

  const infiltrationRatio = BASELINE_INFILTRATION_BY_PURIFIER[input.purifier];
  const indoorPm25Before = round1(safePm25 * infiltrationRatio);

  // Deduplicate categories so repeated toggles of the same mechanism do not double-count.
  const uniqueCategories = Array.from(new Set(input.selectedCategories));

  let residualFraction = 1;
  let dailyCo2KgSaved = 0;
  let dailyPm25GramsAvoided = 0;

  for (const category of uniqueCategories) {
    const factor = IMPACT_FACTORS[category];
    residualFraction *= 1 - factor.indoorPm25ReductionFraction;
    dailyCo2KgSaved += factor.dailyCo2KgSaved;
    dailyPm25GramsAvoided += factor.dailyPm25GramsAvoided;
  }

  // Cap combined indoor PM2.5 attenuation at 92% for physical realism.
  const combinedReduction = Math.min(0.92, Math.max(0, 1 - residualFraction));
  const indoorPm25After = round1(indoorPm25Before * (1 - combinedReduction));
  const pm25DropUgM3 = round1(Math.max(0, indoorPm25Before - indoorPm25After));

  const roundedDailyCo2 = round2(dailyCo2KgSaved);
  const roundedDailyPm25 = round2(dailyPm25GramsAvoided);
  const winterCo2KgSaved = round1(roundedDailyCo2 * WINTER_SEASON_DAYS);
  const winterPm25GramsAvoided = round1(roundedDailyPm25 * WINTER_SEASON_DAYS);

  const communityWinterCo2Tons = round2(
    (winterCo2KgSaved * households) / 1000,
  );
  const weeklyCommunityCo2Kg = roundedDailyCo2 * 7 * households;
  const equivalentCarsOffRoadWeek = round1(
    weeklyCommunityCo2Kg / CAR_WEEKLY_CO2_KG,
  );

  return {
    indoorPm25Before,
    indoorPm25After,
    indoorReductionPercent: Math.round(combinedReduction * 100),
    pm25DropUgM3,
    cigaretteEquivAvoidedPerDay: round1(pm25DropUgM3 / PM25_PER_CIGARETTE_UG_M3),
    dailyCo2KgSaved: roundedDailyCo2,
    dailyPm25GramsAvoided: roundedDailyPm25,
    winterCo2KgSaved,
    winterPm25GramsAvoided,
    communityWinterCo2Tons,
    equivalentCarsOffRoadWeek,
  };
}
