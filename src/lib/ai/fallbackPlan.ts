import {
  ActionPlanResponseSchema,
  type ActionPlanResponse,
  type AirQualitySnapshot,
  type HouseholdProfile,
  type ImpactCategory,
  type IndoorHack,
  type RoutineStep,
  type SustainableSwap,
} from "../schemas";

export { buildFallbackChatReply } from "./fallbackChat";

function buildRoutineSteps(
  airQuality: AirQualitySnapshot,
  profile: HouseholdProfile,
  sensitiveAlert: boolean,
): RoutineStep[] {
  const { windows } = airQuality;
  const commuteImpact: ImpactCategory =
    profile.commute === "two_wheeler"
      ? "two_wheeler_to_transit"
      : profile.commute === "solo_car"
        ? "car_to_transit"
        : "carpool_school_run";

  const commuteTitle =
    profile.commute === "remote"
      ? "Skip peak-hour errands and batch one midday walk"
      : profile.commute === "two_wheeler"
        ? "Swap two-wheeler trip for enclosed transit or N95 commute"
        : profile.commute === "solo_car"
          ? "Shift solo car trip to metro/bus or 3-family carpool"
          : "Maintain low-emission transit / carpool timing";

  const commuteDetail =
    profile.commute === "remote"
      ? `Avoid stepping out during ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel}; combine essential errands into ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel}.`
      : `Peak winter inversion (${windows.peakHazard.avgPm25} µg/m³) traps tailpipe exhaust at breathing height. Shifting off solo vehicles cuts neighborhood PM2.5 and personal dose.`;

  const purifierStepCategory: ImpactCategory =
    profile.purifier === "hepa" ? "hepa_filtration" : "diy_corsi_box";

  return [
    {
      id: "routine-morning-commute",
      timeWindow: `${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel}`,
      title: commuteTitle,
      detail: commuteDetail,
      whyItHelps:
        "Cold morning ground inversions hold exhaust plumes near sidewalks and school gates before sunlight breaks the thermal cap.",
      impactCategory: commuteImpact,
      costTier: "free",
    },
    {
      id: "routine-midday-window",
      timeWindow: `${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel}`,
      title: windows.bestVentilation.recommended
        ? "Controlled 15-minute midday air purge"
        : "Keep sealed; run clean-room recirculation",
      detail: windows.bestVentilation.recommended
        ? `Outdoor PM2.5 dips to ~${windows.bestVentilation.avgPm25} µg/m³. Open opposite windows briefly to flush indoor CO₂, then close and filter.`
        : `Even the cleanest hour averages ~${windows.bestVentilation.avgPm25} µg/m³. Keep exterior windows latched and run ${profile.purifier === "hepa" ? "your HEPA unit on medium-high" : "a DIY MERV-13 fan filter"}.`,
      whyItHelps:
        "Timing ventilation to atmospheric boundary-layer mixing prevents pulling peak morning/evening smog indoors.",
      impactCategory: "window_timing",
      costTier: "free",
    },
    {
      id: "routine-cooking-protocol",
      timeWindow: "Meal Prep Hours",
      title:
        profile.cookingFuel === "electric"
          ? "Cover pans and run hood during high-heat cooking"
          : "Vent cooking fumes & shift boiling to electric kettle",
      detail:
        profile.cookingFuel === "biomass"
          ? "Avoid open solid-fuel cooking indoors; use clean electric/induction or vented cookstoves with lids on."
          : "Gas flames and frying aerosols spike indoor PM2.5 and NO₂ inside sealed winter rooms. Run exhaust outward and keep lids on.",
      whyItHelps:
        "Sealed winter apartments trap cooking combustion particles for hours unless vented or replaced with electric prep.",
      impactCategory: "exhaust_cooking",
      costTier: "free",
    },
    {
      id: "routine-evening-lockdown",
      timeWindow: "19:30–23:00",
      title: sensitiveAlert
        ? "Seal bedroom clean zone & ban indoor smoke"
        : "Evening damp wipe-down & clean-air sleep setup",
      detail:
        "Close outer doors, place a rolled damp cloth along drafty thresholds, and skip incense, candles, or mosquito coils overnight.",
      whyItHelps:
        "Nighttime radiative cooling reforms the winter inversion lid, causing outdoor PM2.5 to surge while families sleep.",
      impactCategory: purifierStepCategory,
      costTier: profile.purifier === "hepa" ? "free" : "budget",
    },
  ];
}

function buildIndoorHacks(profile: HouseholdProfile): IndoorHack[] {
  const hasHepa = profile.purifier === "hepa";

  return [
    {
      id: "hack-filtration-core",
      title: hasHepa
        ? "Optimize HEPA placement for overnight clean zone"
        : "Build a $35 MERV-13 Box-Fan Air Cleaner (Corsi-style)",
      steps: hasHepa
        ? [
            "Move purifier 30–50 cm away from walls or curtains so intake airflow is unobstructed.",
            "Close doors to the main sleeping room so the unit maintains 4+ air changes per hour.",
            "Run continuous low/medium fan overnight rather than noisy bursts.",
          ]
        : [
            "Tape a 20×20-inch MERV-13 (or HEPA-grade) furnace filter flush against the intake side of a standard box fan.",
            "Seal corner air gaps with painter's tape so polluted air is forced through the filter pleats.",
            "Run on medium speed in the primary bedroom or living room with doors closed.",
          ],
      whyItHelps:
        "Continuous single-room filtration cuts indoor fine particulates by ~48–58% even when outdoor winter smog stays severe.",
      impactCategory: hasHepa ? "hepa_filtration" : "diy_corsi_box",
      costTier: hasHepa ? "free" : "budget",
      setupMinutes: hasHepa ? 5 : 15,
    },
    {
      id: "hack-draft-sealing",
      title: "Zero-cost doorway & window gap sealing",
      steps: [
        "Feel along window frames and balcony doors for cold winter drafts entering the room.",
        "Tuck a rolled towel or removable foam weatherstrip along the bottom door gap.",
        "Keep exhaust bathroom fans off when not actively showering so they do not pull smoky air through cracks.",
      ],
      whyItHelps:
        "Slows cold smog infiltration into living spaces and reduces space-heating energy loss simultaneously.",
      impactCategory: "draft_sealing",
      costTier: "free",
      setupMinutes: 10,
    },
    {
      id: "hack-no-combustion",
      title: "Strict zero-combustion indoor rule on smog days",
      steps: [
        "Pause scented candles, incense sticks, agarbatti, and fireplace lighting until AQI drops below 100.",
        "Pre-boil tea/water in an electric kettle instead of open-flame simmering.",
        "Crack kitchen window slightly only while exhaust hood is actively pulling steam outward.",
      ],
      whyItHelps:
        "A single stick of incense or unvented gas burner inside a sealed winter room can match outdoor hazardous PM2.5.",
      impactCategory: "no_indoor_combustion",
      costTier: "free",
      setupMinutes: 5,
    },
    {
      id: "hack-damp-cleaning",
      title: "Wet-mop & microfiber wipe instead of dry sweeping",
      steps: [
        "Replace dry brooms and feather dusters with a damp microfiber cloth or wet mop.",
        "Wipe windowsills and kids' play mats every evening where black soot settles.",
        "Leave outdoor shoes and jackets in an entryway bin so road dust stays off living-room floors.",
      ],
      whyItHelps:
        "Dry sweeping kicks settled heavy soot back into the 1-meter breathing zone where children and pets inhale it.",
      impactCategory: "damp_cleaning",
      costTier: "free",
      setupMinutes: 12,
    },
  ];
}

function buildSustainableSwaps(profile: HouseholdProfile): SustainableSwap[] {
  const twoWheeler = profile.commute === "two_wheeler";
  const solidHeat = profile.heating === "solid_fuel";

  return [
    {
      id: "swap-mobility",
      title:
        profile.commute === "carpool"
          ? "Organize 3-household school-run carpool rotation"
          : "Replace short solo vehicle trips with metro, bus, or carpool",
      replaces: twoWheeler
        ? "Daily solo two-wheeler commute"
        : "Daily solo fuel-car commute",
      detail:
        "Cold winter engines emit 2–3× more particulates during the first 5 km before catalytic converters warm up. Consolidation removes cold starts.",
      whyItHelps:
        "Removing two morning cold-start trips cuts hyper-local NO₂ and primary brake/tailpipe soot along residential streets by up to 4.1 kg CO₂e/day.",
      communityAngle:
        "Pair two neighbors on the same school or office corridor to eliminate 2 morning cold-start vehicles.",
      impactCategory: twoWheeler ? "two_wheeler_to_transit" : "car_to_transit",
      costTier: "free",
    },
    {
      id: "swap-school-run",
      title: "No-idling pickup zone + walking bus outside peak window",
      replaces: "Curbside car idling outside schools & apartments",
      detail:
        "Ask drivers and delivery vans to switch engines off when waiting >30 seconds, especially around school gates.",
      whyItHelps:
        "Idling tailpipes sit directly at children's lung height during drop-off queues; engine-off zones prevent concentrated PM2.5 plumes around courtyards.",
      communityAngle:
        "Parents taking turns at the drop-off lane keeps exhaust away from children's breathing height.",
      impactCategory: "carpool_school_run",
      costTier: "free",
    },
    {
      id: "swap-heating-clean",
      title: solidHeat
        ? "Replace wood/coal space heaters with electric oil/heat-pump heating"
        : "Seal rooms + lower thermostat 1.5°C with layered winter wear",
      replaces: solidHeat
        ? "Residential solid-fuel / biomass burning"
        : "Unsealed high-draw winter heating",
      detail: solidHeat
        ? "Solid-fuel heating is one of the largest winter PM2.5 sources per household. Clean electric heat eliminates indoor and local smoke."
        : "Draft sealing keeps warmth in longer so electric or gas heaters cycle less often, cutting grid/fuel emissions.",
      whyItHelps: solidHeat
        ? "Eliminating solid-fuel combustion stops dense winter black-carbon smoke from lingering inside bedrooms and neighboring balconies (~9 g PM2.5/day avoided)."
        : "Tighter thermal envelopes cut furnace runtime under stagnant winter air, lowering both indoor infiltration and regional peak-load emissions.",
      communityAngle:
        "Encourage building security and maintenance staff to swap outdoor bonfires for electric warmers.",
      impactCategory: "electric_heating_swap",
      costTier: solidHeat ? "upgrade" : "free",
    },
    {
      id: "swap-community-zero-burn",
      title: "Neighborhood bulk delivery & zero leaf-burning pledge",
      replaces: "Scattered single-item deliveries & garden waste burning",
      detail:
        "Compost or bag dry winter leaves instead of burning them; smoldering piles trap dense smoke under evening inversions.",
      whyItHelps:
        "Open winter leaf fires release slow, wet biomass smoke that gets trapped beneath evening thermal inversions across the whole block.",
      communityAngle:
        "Coordinate a 10-home grocery/errand window and a block-wide zero-burn notice on high-AQI days.",
      impactCategory: "community_carpool",
      costTier: "free",
    },
  ];
}

/**
 * Generates a rich, deterministic winter-smog action plan grounded in live AQI
 * telemetry and the user's household profile whenever Gemini is unconfigured
 * or unavailable.
 */
export function buildFallbackPlan(
  airQuality: AirQualitySnapshot,
  profile: HouseholdProfile,
): ActionPlanResponse {
  const { location, current, windows } = airQuality;
  const severe = current.usAqi >= 151;
  const sensitiveAlert = current.usAqi >= 101 || profile.vulnerabilities.length > 0;

  const vulnNote =
    profile.vulnerabilities.length > 0
      ? `Tailored for ${profile.vulnerabilities.join(", ")} sensitivity.`
      : "Optimized for general household protection.";

  const headline = severe
    ? `${location.name} is at US AQI ${current.usAqi} (${current.categoryLabel}): keep windows sealed during ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel} inversion peaks and prioritize indoor filtration. ${vulnNote}`
    : `${location.name} is at US AQI ${current.usAqi} (${current.categoryLabel}): target ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel} for low-emission errands and brief air exchange. ${vulnNote}`;

  const communityAdvisoryDraft = `${location.name} Air Alert (US AQI ${current.usAqi} · ${current.categoryLabel}): Peak inversion smog hits ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel}. Please avoid outdoor exercise for kids/seniors, switch off idling engines at gates, pause leaf/trash burning, and ${windows.bestVentilation.recommended ? `ventilate briefly only ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel}` : "keep windows sealed & run filtration"}.`;

  return ActionPlanResponseSchema.parse({
    headline: headline.slice(0, 260),
    mode: "fallback",
    routine: buildRoutineSteps(airQuality, profile, sensitiveAlert),
    indoorHacks: buildIndoorHacks(profile),
    sustainableAlternatives: buildSustainableSwaps(profile),
    communityAdvisoryDraft: communityAdvisoryDraft.slice(0, 420),
  });
}
