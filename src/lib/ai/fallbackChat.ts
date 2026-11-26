import type { AirQualitySnapshot, HouseholdProfile } from "../schemas";
import { detectRespiratoryEmergency, sanitizeUserText } from "./safety";

/**
 * Provides contextual, telemetry-grounded chat replies in offline/no-key mode
 * or when upstream Gemini streaming is unavailable.
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

  if (
    q.includes("whatsapp") ||
    q.includes("draft") ||
    q.includes("community") ||
    q.includes("notice")
  ) {
    return `${prefix}Here is a ready-to-share advisory for ${location.name} right now:\n\n• "${location.name} Smog Notice — US AQI ${current.usAqi} (${current.categoryLabel}, PM2.5 ${current.pm25} µg/m³)."\n• Highest smog traps between ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel}; please keep children/seniors indoors and wear N95/KN95 if commuting.\n• ${windows.bestVentilation.recommended ? `Brief window purge only during ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel}.` : "Keep windows sealed all day and run HEPA/MERV-13 fan filters."}\n• Community pledge: zero idling at gates, zero leaf burning, and carpool school runs today.`;
  }

  if (
    q.includes("kid") ||
    q.includes("child") ||
    q.includes("play") ||
    q.includes("outside") ||
    q.includes("school")
  ) {
    if (current.usAqi >= 151) {
      return `${prefix}For ${location.name} at US AQI ${current.usAqi} (${current.categoryLabel}), outdoor vigorous play is NOT recommended today—especially with ${profile.vulnerabilities.includes("asthma") ? "asthma sensitivity" : "children's higher breathing rate"}.\n\n• Keep recess/play indoors with a HEPA or DIY MERV-13 box-fan filter running.\n• For school transit during ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel}, use a snug child-sized N95/KF94 mask and carpool rather than walking beside busy roads.\n• ${windows.bestVentilation.recommended ? `A calm 10–15 min step-out is safest only around ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel}.` : "Even the midday dip stays above safe thresholds today—keep outdoor time minimal."}`;
    }
    return `${prefix}At US AQI ${current.usAqi} (${current.categoryLabel}) in ${location.name}, light outdoor play is reasonable if you avoid the ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel} peak.\n\n• Best outdoor slot today: ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel} (PM2.5 ~${windows.bestVentilation.avgPm25} µg/m³).\n• Watch sensitive kids for coughing or shortness of breath and move indoors if traffic haze thickens.`;
  }

  if (
    q.includes("purifier") ||
    q.includes("without") ||
    q.includes("diy") ||
    q.includes("indoor") ||
    q.includes("hack")
  ) {
    return `${prefix}You can cut indoor PM2.5 in ${location.name} without an expensive purifier:\n\n• Build a ~$35 DIY box-fan filter: tape a 20×20 MERV-13 filter flush to the intake of a box fan and run it in a closed bedroom (~48% PM2.5 drop).\n• Seal doorway gaps with a rolled damp towel and turn off unused bathroom exhaust fans.\n• Cook with lids on + outward exhaust, wet-mop instead of dry sweeping, and avoid incense or candles.\n${adoptedTitles.length > 0 ? `• You already adopted ${adoptedTitles.length} action(s) today—keep those active overnight.` : ""}`;
  }

  if (
    q.includes("inversion") ||
    q.includes("sunset") ||
    q.includes("night") ||
    q.includes("why")
  ) {
    return `${prefix}Winter smog surges after sunset in ${location.name} because of a **temperature inversion**:\n\n• After sundown, the ground cools rapidly and chills the lowest layer of air, while warmer air above acts like a lid.\n• Evening traffic and home heating emissions cannot rise or disperse, concentrating PM2.5 right at street level (peaking ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel} around ${windows.peakHazard.avgPm25} µg/m³).\n• Midday sun briefly warms the surface (${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel}), thinning smog to ~${windows.bestVentilation.avgPm25} µg/m³.`;
  }

  return `${prefix}Current briefing for ${location.name}: **US AQI ${current.usAqi} (${current.categoryLabel})**, PM2.5 **${current.pm25} µg/m³**.\n\n• **Ventilation:** ${windows.bestVentilation.recommended ? `Best 2-hour window is ${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel} (~${windows.bestVentilation.avgPm25} µg/m³).` : `Keep windows sealed—even the cleanest window (${windows.bestVentilation.startLabel}–${windows.bestVentilation.endLabel}) averages ${windows.bestVentilation.avgPm25} µg/m³.`}\n• **Avoid outdoors:** Peak inversion hazard hits ${windows.peakHazard.startLabel}–${windows.peakHazard.endLabel} (~${windows.peakHazard.avgPm25} µg/m³).\n• **Top next step:** ${profile.purifier === "none" ? "Tape a MERV-13 filter onto a box fan in your main bedroom and seal door drafts." : "Keep your bedroom sealed with continuous filtration and run kitchen exhaust while cooking."}\n\n*(Guided offline mode active — add GEMINI_API_KEY in .env.local to enable live Gemini Flash reasoning.)*`;
}
