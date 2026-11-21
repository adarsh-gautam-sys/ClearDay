import { z } from "zod";

export const LocationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  country: z.string().trim().min(1).max(80),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  timezone: z.string().trim().min(1).max(64),
});

export const AqiBandSchema = z.enum([
  "good",
  "moderate",
  "sensitive",
  "unhealthy",
  "very_unhealthy",
  "hazardous",
]);

export const HourlyPointSchema = z.object({
  time: z.string().min(1).max(40),
  hourLabel: z.string().min(1).max(16),
  usAqi: z.number().finite().min(0).max(1000),
  pm25: z.number().finite().min(0).max(2000),
});

export const VentilationWindowSchema = z.object({
  startLabel: z.string().min(1).max(16),
  endLabel: z.string().min(1).max(16),
  avgPm25: z.number().finite().min(0).max(2000),
  recommended: z.boolean(),
  guidance: z.string().min(1).max(260),
});

export const PeakHazardWindowSchema = z.object({
  startLabel: z.string().min(1).max(16),
  endLabel: z.string().min(1).max(16),
  avgPm25: z.number().finite().min(0).max(2000),
  guidance: z.string().min(1).max(260),
});

export const AirQualitySnapshotSchema = z.object({
  location: LocationSchema,
  fetchedAt: z.string().min(1).max(40),
  source: z.enum(["open-meteo", "fallback"]),
  current: z.object({
    usAqi: z.number().finite().min(0).max(1000),
    pm25: z.number().finite().min(0).max(2000),
    pm10: z.number().finite().min(0).max(2500),
    no2: z.number().finite().min(0).max(2000),
    o3: z.number().finite().min(0).max(2000),
    co: z.number().finite().min(0).max(100000),
    band: AqiBandSchema,
    categoryLabel: z.string().min(1).max(60),
    healthSummary: z.string().min(1).max(280),
  }),
  hourly: z.array(HourlyPointSchema).min(1).max(48),
  windows: z.object({
    bestVentilation: VentilationWindowSchema,
    peakHazard: PeakHazardWindowSchema,
  }),
});

export const ScopeModeSchema = z.enum(["household", "community"]);

export const VulnerabilitySchema = z.enum([
  "children",
  "elderly",
  "asthma",
  "pets",
]);

export const CommuteModeSchema = z.enum([
  "solo_car",
  "two_wheeler",
  "transit",
  "carpool",
  "walk_cycle",
  "remote",
]);

export const PurifierSetupSchema = z.enum(["none", "hepa", "diy_box"]);

export const CookingFuelSchema = z.enum(["gas", "electric", "biomass"]);

export const HeatingSourceSchema = z.enum([
  "none",
  "electric",
  "gas",
  "solid_fuel",
]);

export const HouseholdProfileSchema = z.object({
  scope: ScopeModeSchema,
  vulnerabilities: z.array(VulnerabilitySchema).max(4),
  commute: CommuteModeSchema,
  purifier: PurifierSetupSchema,
  cookingFuel: CookingFuelSchema,
  heating: HeatingSourceSchema,
});

export const DEFAULT_PROFILE: z.infer<typeof HouseholdProfileSchema> = {
  scope: "household",
  vulnerabilities: ["children"],
  commute: "solo_car",
  purifier: "none",
  cookingFuel: "gas",
  heating: "electric",
};

export const ImpactCategorySchema = z.enum([
  "hepa_filtration",
  "diy_corsi_box",
  "draft_sealing",
  "exhaust_cooking",
  "no_indoor_combustion",
  "window_timing",
  "damp_cleaning",
  "car_to_transit",
  "two_wheeler_to_transit",
  "carpool_school_run",
  "electric_heating_swap",
  "community_carpool",
]);

export const CostTierSchema = z.enum(["free", "budget", "upgrade"]);

export const RoutineStepSchema = z.object({
  id: z.string().min(1).max(48),
  timeWindow: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  detail: z.string().min(1).max(400),
  whyItHelps: z.string().min(1).max(280),
  impactCategory: ImpactCategorySchema,
  costTier: CostTierSchema,
});

export const IndoorHackSchema = z.object({
  id: z.string().min(1).max(48),
  title: z.string().min(1).max(120),
  steps: z.array(z.string().min(1).max(220)).min(2).max(5),
  whyItHelps: z.string().min(1).max(280),
  impactCategory: ImpactCategorySchema,
  costTier: CostTierSchema,
  setupMinutes: z.number().int().min(1).max(240),
});

export const SustainableSwapSchema = z.object({
  id: z.string().min(1).max(48),
  title: z.string().min(1).max(120),
  replaces: z.string().min(1).max(100),
  detail: z.string().min(1).max(380),
  communityAngle: z.string().min(1).max(240),
  impactCategory: ImpactCategorySchema,
  costTier: CostTierSchema,
});

export const ActionPlanResponseSchema = z.object({
  headline: z.string().min(1).max(260),
  mode: z.enum(["gemini", "fallback"]),
  routine: z.array(RoutineStepSchema).min(3).max(6),
  indoorHacks: z.array(IndoorHackSchema).min(3).max(5),
  sustainableAlternatives: z.array(SustainableSwapSchema).min(3).max(5),
  communityAdvisoryDraft: z.string().min(1).max(420),
});

export const PlanRequestSchema = z.object({
  airQuality: AirQualitySnapshotSchema,
  profile: HouseholdProfileSchema,
});

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1500),
});

export const ChatRequestSchema = z.object({
  airQuality: AirQualitySnapshotSchema,
  profile: HouseholdProfileSchema,
  adoptedTitles: z.array(z.string().trim().min(1).max(140)).max(20),
  history: z.array(ChatMessageSchema).max(8),
  message: z.string().trim().min(1).max(500),
});

export const CoordinateQuerySchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lon: z.coerce.number().finite().min(-180).max(180),
  name: z.string().trim().min(1).max(80).default("Selected Location"),
  country: z.string().trim().min(1).max(80).default("Region"),
  timezone: z.string().trim().min(1).max(64).default("auto"),
});

export type LocationInfo = z.infer<typeof LocationSchema>;
export type AqiBand = z.infer<typeof AqiBandSchema>;
export type HourlyPoint = z.infer<typeof HourlyPointSchema>;
export type AirQualitySnapshot = z.infer<typeof AirQualitySnapshotSchema>;
export type ScopeMode = z.infer<typeof ScopeModeSchema>;
export type Vulnerability = z.infer<typeof VulnerabilitySchema>;
export type CommuteMode = z.infer<typeof CommuteModeSchema>;
export type PurifierSetup = z.infer<typeof PurifierSetupSchema>;
export type CookingFuel = z.infer<typeof CookingFuelSchema>;
export type HeatingSource = z.infer<typeof HeatingSourceSchema>;
export type HouseholdProfile = z.infer<typeof HouseholdProfileSchema>;
export type ImpactCategory = z.infer<typeof ImpactCategorySchema>;
export type CostTier = z.infer<typeof CostTierSchema>;
export type RoutineStep = z.infer<typeof RoutineStepSchema>;
export type IndoorHack = z.infer<typeof IndoorHackSchema>;
export type SustainableSwap = z.infer<typeof SustainableSwapSchema>;
export type ActionPlanResponse = z.infer<typeof ActionPlanResponseSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
