import { ClearDayWorkspace } from "@/components/ClearDayWorkspace";
import { generateActionPlan } from "@/lib/ai/gemini";
import { fetchAirQuality } from "@/lib/air-quality/openMeteo";
import { findPresetById } from "@/lib/air-quality/presets";
import { DEFAULT_PROFILE } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const defaultPreset = findPresetById("new-delhi");
  const initialAirQuality = await fetchAirQuality(defaultPreset.location);
  const initialPlan = await generateActionPlan(
    initialAirQuality,
    DEFAULT_PROFILE,
  );

  return (
    <ClearDayWorkspace
      initialAirQuality={initialAirQuality}
      initialPlan={initialPlan}
    />
  );
}
