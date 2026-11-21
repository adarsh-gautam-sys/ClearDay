import { describe, expect, it } from "vitest";
import { calculateImpact } from "@/lib/impact/calculator";
import type { ImpactCategory } from "@/lib/schemas";

describe("calculateImpact", () => {
  it("returns zero reductions when no actions are selected", () => {
    const summary = calculateImpact({
      currentPm25: 200,
      purifier: "none",
      selectedCategories: [],
      communityHouseholds: 1,
    });

    expect(summary.indoorPm25Before).toBe(130);
    expect(summary.indoorPm25After).toBe(130);
    expect(summary.indoorReductionPercent).toBe(0);
    expect(summary.dailyCo2KgSaved).toBe(0);
    expect(summary.cigaretteEquivAvoidedPerDay).toBe(0);
  });

  it("deduplicates repeated impact categories and caps reduction at 92%", () => {
    const allIndoor: ImpactCategory[] = [
      "hepa_filtration",
      "hepa_filtration",
      "diy_corsi_box",
      "draft_sealing",
      "exhaust_cooking",
      "no_indoor_combustion",
      "window_timing",
      "damp_cleaning",
      "electric_heating_swap",
    ];

    const summary = calculateImpact({
      currentPm25: 250,
      purifier: "none",
      selectedCategories: allIndoor,
      communityHouseholds: 1,
    });

    const single = calculateImpact({
      currentPm25: 250,
      purifier: "none",
      selectedCategories: ["hepa_filtration"],
      communityHouseholds: 1,
    });

    const duplicated = calculateImpact({
      currentPm25: 250,
      purifier: "none",
      selectedCategories: ["hepa_filtration", "hepa_filtration"],
      communityHouseholds: 1,
    });

    expect(duplicated.indoorReductionPercent).toBe(single.indoorReductionPercent);
    expect(duplicated.dailyCo2KgSaved).toBe(single.dailyCo2KgSaved);
    expect(summary.indoorReductionPercent).toBeLessThanOrEqual(92);
    expect(summary.indoorPm25After).toBeGreaterThan(0);
  });

  it("scales winter CO2 savings linearly across community households", () => {
    const single = calculateImpact({
      currentPm25: 150,
      purifier: "none",
      selectedCategories: ["car_to_transit", "exhaust_cooking"],
      communityHouseholds: 1,
    });

    const block = calculateImpact({
      currentPm25: 150,
      purifier: "none",
      selectedCategories: ["car_to_transit", "exhaust_cooking"],
      communityHouseholds: 100,
    });

    expect(block.winterCo2KgSaved).toBe(single.winterCo2KgSaved);
    expect(block.communityWinterCo2Tons).toBeCloseTo(
      (single.winterCo2KgSaved * 100) / 1000,
      2,
    );
    expect(block.equivalentCarsOffRoadWeek).toBeGreaterThan(
      single.equivalentCarsOffRoadWeek * 90,
    );
  });
});
