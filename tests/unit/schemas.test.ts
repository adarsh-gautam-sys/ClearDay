import { describe, expect, it } from "vitest";
import { buildPresetSnapshot, CITY_PRESETS } from "@/lib/air-quality/presets";
import {
  ChatRequestSchema,
  CoordinateQuerySchema,
  DEFAULT_PROFILE,
  PlanRequestSchema,
} from "@/lib/schemas";

describe("Zod schemas", () => {
  const sampleSnapshot = buildPresetSnapshot(CITY_PRESETS[0]!);

  it("validates well-formed plan and chat payloads", () => {
    expect(
      PlanRequestSchema.safeParse({
        airQuality: sampleSnapshot,
        profile: DEFAULT_PROFILE,
      }).success,
    ).toBe(true);

    expect(
      ChatRequestSchema.safeParse({
        airQuality: sampleSnapshot,
        profile: DEFAULT_PROFILE,
        adoptedTitles: ["Run HEPA Purifier"],
        history: [{ role: "user", content: "Can kids play outside?" }],
        message: "How do I seal window drafts cleanly?",
      }).success,
    ).toBe(true);
  });

  it("rejects out-of-range coordinates and oversized chat messages", () => {
    expect(
      CoordinateQuerySchema.safeParse({ lat: 95, lon: 10 }).success,
    ).toBe(false);

    expect(
      CoordinateQuerySchema.safeParse({ lat: 28.6, lon: 190 }).success,
    ).toBe(false);

    expect(
      ChatRequestSchema.safeParse({
        airQuality: sampleSnapshot,
        profile: DEFAULT_PROFILE,
        adoptedTitles: [],
        history: [],
        message: "a".repeat(501),
      }).success,
    ).toBe(false);

    expect(
      ChatRequestSchema.safeParse({
        airQuality: sampleSnapshot,
        profile: DEFAULT_PROFILE,
        adoptedTitles: [],
        history: [],
        message: "   ",
      }).success,
    ).toBe(false);
  });
});
