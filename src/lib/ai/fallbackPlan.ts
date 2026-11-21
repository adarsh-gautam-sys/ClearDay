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
import { detectRespiratoryEmergency, sanitizeUserText } from "./safety";

function hasVulnerability(profile: HouseholdProfile): boolean {
  return profile.vulnerabilities.length > 0;
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
  const sensitiveAlert = current.usAqi >= 101 || hasVulnerability(profile);

  const vulnNote =
    profile.vulnerabilities.length > 0
      ? `Tailored for ${profile.vulnerabilities.join(", ")} sensitivity.`
      : "Optimized for general household protection.";

  const headline = severe
    ? `${location.name} is at US AQI ${current.usAqi} (${current.categoryLabel}): keep windows sealed during ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel} inversion peaks and prioritize indoor filtration. ${vulnNote}`
    : `${location.name} is at US AQI ${current.usAqi} (${current.categoryLabel}): target ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel} for low-emission errands and brief air exchange. ${vulnNote}`;

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

  const routine: RoutineStep[] = [
    {
      id: "routine-morning-commute",
      timeWindow: windows.peakHazard.startLabel + "–" + windows.peakHazard.endLabel,
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

  const indoorHacks: IndoorHack[] = [
    {
      id: "hack-filtration-core",
      title:
        profile.purifier === "hepa"
          ? "Optimize HEPA placement for overnight clean zone"
          : "Build a \$35 MERV-13 Box-Fan Air Cleaner (Corsi-style)",
      steps:
        profile.purifier === "hepa"
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
      impactCategory: profile.purifier === "hepa" ? "hepa_filtration" : "diy_corsi_box",
      costTier: profile.purifier === "hepa" ? "free" : "budget",
      setupMinutes: profile.purifier === "hepa" ? 5 : 15,
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

  const sustainableAlternatives: SustainableSwap[] = [
    {
      id: "swap-mobility",
      title:
        profile.commute === "carpool"
          ? "Organize 3-household school-run carpool rotation"
          : "Replace short solo vehicle trips with metro, bus, or carpool",
      replaces:
        profile.commute === "two_wheeler"
          ? "Daily solo two-wheeler commute"
          : "Daily solo fuel-car commute",
      detail:
        "Cold winter engines emit 2–3× more particulates during the first 5 km before catalytic converters warm up. Consolidation removes cold starts.",
      communityAngle:
        "Pair two neighbors on the same school or office corridor to eliminate 2 morning cold-start vehicles.",
      impactCategory:
        profile.commute === "two_wheeler"
          ? "two_wheeler_to_transit"
          : "car_to_transit",
      costTier: "free",
    },
    {
      id: "swap-school-run",
      title: "No-idling pickup zone + walking bus outside peak window",
      replaces: "Curbside car idling outside schools & apartments",
      detail:
        "Ask drivers and delivery vans to switch engines off when waiting >30 seconds, especially around school gates.",
      communityAngle:
        "Parents taking turns at the drop-off lane keeps exhaust away from children's breathing height.",
      impactCategory: "carpool_school_run",
      costTier: "free",
    },
    {
      id: "swap-heating-clean",
      title:
        profile.heating === "solid_fuel"
          ? "Replace wood/coal space heaters with electric oil/heat-pump heating"
          : "Seal rooms + lower thermostat 1.5°C with layered winter wear",
      replaces:
        profile.heating === "solid_fuel"
          ? "Residential solid-fuel / biomass burning"
          : "Unsealed high-draw winter heating",
      detail:
        profile.heating === "solid_fuel"
          ? "Solid-fuel heating is one of the largest winter PM2.5 sources per household. Clean electric heat eliminates indoor and local smoke."
          : "Draft sealing keeps warmth in longer so electric or gas heaters cycle less often, cutting grid/fuel emissions.",
      communityAngle:
        "Encourage building security and maintenance staff to swap outdoor bonfires for electric warmers.",
      impactCategory: "electric_heating_swap",
      costTier: profile.heating === "solid_fuel" ? "upgrade" : "free",
    },
    {
      id: "swap-community-zero-burn",
      title: "Neighborhood bulk delivery & zero leaf-burning pledge",
      replaces: "Scattered single-item deliveries & garden waste burning",
      detail:
        "Compost or bag dry winter leaves instead of burning them; smoldering piles trap dense smoke under evening inversions.",
      communityAngle:
        "Coordinate a 10-home grocery/errand window and a block-wide zero-burn notice on high-AQI days.",
      impactCategory: "community_carpool",
      costTier: "free",
    },
  ];

  const communityAdvisoryDraft = `${location.name} Air Alert (US AQI ${current.usAqi} · ${current.categoryLabel}): Peak inversion smog hits ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel}. Please avoid outdoor exercise for kids/seniors, switch off idling engines at gates, pause leaf/trash burning, and ${windows.bestVentilation.recommended ? `ventilate briefly only ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel}` : "keep windows sealed & run filtration"}.`;

  return ActionPlanResponseSchema.parse({
    headline: headline.slice(0, 260),
    mode: "fallback",
    routine,
    indoorHacks,
    sustainableAlternatives,
    communityAdvisoryDraft: communityAdvisoryDraft.slice(0, 420),
  });
}

/**
 * Provides contextual, telemetry-grounded chat replies in offline/no-key mode.
 */
export function buildFallbackChatReply(params: {
  airQuality: AirQualitySnapshot;
  profile: HouseholdProfile;
  adoptedTitles: string[];
  message: string;
}): string {
  const { airQuality, profile, adoptedTitles, message } = params;
  const { location, current, windows } = airQuality;
  const q = sanitizeUserText(message, 500).toLowerCase();
  const emergency = detectRespiratoryEmergency(q);

  const prefix = emergency.isEmergency
    ? `⚠️ ${emergency.alertMessage}\n\n`
    : "";

  if (q.includes("whatsapp") || q.includes("draft") || q.includes("community") || q.includes("notice")) {
    return `${prefix}Here is a ready-to-share advisory for ${location.name} right now:\n\n• "${location.name} Smog Notice — US AQI ${current.usAqi} (${current.categoryLabel}, PM2.5 ${current.pm25} µg/m³)."\n• Highest smog traps between ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel}; please keep children/seniors indoors and wear N95/KN95 if commuting.\n• ${windows.bestVentilation.recommended ? `Brief window purge only during ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel}.` : "Keep windows sealed all day and run HEPA/MERV-13 fan filters."}\n• Community pledge: zero idling at gates, zero leaf burning, and carpool school runs today.`;
  }

  if (q.includes("kid") || q.includes("child") || q.includes("play") || q.includes("outside") || q.includes("school")) {
    if (current.usAqi >= 151) {
      return `${prefix}For ${location.name} at US AQI ${current.usAqi} (${current.categoryLabel}), outdoor vigorous play is NOT recommended today—especially with ${profile.vulnerabilities.includes("asthma") ? "asthma sensitivity" : "children's higher breathing rate"}.\n\n• Keep recess/play indoors with a HEPA or DIY MERV-13 box-fan filter running.\n• For school transit during ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel}, use a snug child-sized N95/KF94 mask and carpool rather than walking beside busy roads.\n• ${windows.bestVentilation.recommended ? `A calm 10–15 min step-out is safest only around ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel}.` : "Even the midday dip stays above safe thresholds today—keep outdoor time minimal."}`;
    }
    return `${prefix}At US AQI ${current.usAqi} (${current.categoryLabel}) in ${location.name}, light outdoor play is reasonable if you avoid the ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel} peak.\n\n• Best outdoor slot today: ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel} (PM2.5 ~${windows.bestVentilation.avgPm25} µg/m³).\n• Watch sensitive kids for coughing or shortness of breath and move indoors if traffic haze thickens.`;
  }

  if (q.includes("purifier") || q.includes("without") || q.includes("diy") || q.includes("indoor") || q.includes("hack")) {
    return `${prefix}You can cut indoor PM2.5 in ${location.name} without an expensive purifier:\n\n• Build a ~$35 DIY box-fan filter: tape a 20×20 MERV-13 filter flush to the intake of a box fan and run it in a closed bedroom (~48% PM2.5 drop).\n• Seal doorway gaps with a rolled damp towel and turn off unused bathroom exhaust fans.\n• Cook with lids on + outward exhaust, wet-mop instead of dry sweeping, and avoid incense or candles.\n${adoptedTitles.length > 0 ? `• You already adopted ${adoptedTitles.length} action(s) today—keep those active overnight.` : ""}`;
  }

  if (q.includes("inversion") || q.includes("sunset") || q.includes("night") || q.includes("why")) {
    return `${prefix}Winter smog surges after sunset in ${location.name} because of a **temperature inversion**:\n\n• After sundown, the ground cools rapidly and chills the lowest layer of air, while warmer air above acts like a lid.\n• Evening traffic and home heating emissions cannot rise or disperse, concentrating PM2.5 right at street level (peaking ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel} around ${windows.peakHazard.avgPm25} µg/m³).\n• Midday sun briefly warms the surface (${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel}), thinning smog to ~${windows.bestVentilation.avgPm25} µg/m³.`;
  }

  return `${prefix}Current briefing for ${location.name}: **US AQI ${current.usAqi} (${current.categoryLabel})**, PM2.5 **${current.pm25} µg/m³**.\n\n• **Ventilation:** ${windows.bestVentilation.recommended ? `Best 2-hour window is ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel} (~${windows.bestVentilation.avgPm25} µg/m³).` : `Keep windows sealed—even the cleanest window (${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel}) averages ${windows.bestVentilation.avgPm25} µg/m³.`}\n• **Avoid outdoors:** Peak inversion hazard hits ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel} (~${windows.peakHazard.avgPm25} µg/m³).\n• **Top next step:** ${profile.purifier === "none" ? "Tape a MERV-13 filter onto a box fan in your main bedroom and seal door drafts." : "Keep your bedroom sealed with continuous filtration and run kitchen exhaust while cooking."}\n\n*(Guided offline mode active — add GEMINI_API_KEY in .env.local to enable live Gemini Flash reasoning.)*`;
}
