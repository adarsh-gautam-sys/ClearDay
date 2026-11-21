import { GoogleGenAI, Type } from "@google/genai";
import {
  ActionPlanResponseSchema,
  type ActionPlanResponse,
  type AirQualitySnapshot,
  type ChatMessage,
  type HouseholdProfile,
} from "../schemas";
import { buildFallbackChatReply, buildFallbackPlan } from "./fallbackPlan";
import { buildChatPrompts, buildPlanPrompts } from "./prompts";

const IMPACT_CATEGORIES = [
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
] as const;

const COST_TIERS = ["free", "budget", "upgrade"] as const;

const ACTION_PLAN_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    mode: { type: Type.STRING, enum: ["gemini", "fallback"] },
    routine: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          timeWindow: { type: Type.STRING },
          title: { type: Type.STRING },
          detail: { type: Type.STRING },
          whyItHelps: { type: Type.STRING },
          impactCategory: { type: Type.STRING, enum: [...IMPACT_CATEGORIES] },
          costTier: { type: Type.STRING, enum: [...COST_TIERS] },
        },
        required: [
          "id",
          "timeWindow",
          "title",
          "detail",
          "whyItHelps",
          "impactCategory",
          "costTier",
        ],
      },
    },
    indoorHacks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          whyItHelps: { type: Type.STRING },
          impactCategory: { type: Type.STRING, enum: [...IMPACT_CATEGORIES] },
          costTier: { type: Type.STRING, enum: [...COST_TIERS] },
          setupMinutes: { type: Type.INTEGER },
        },
        required: [
          "id",
          "title",
          "steps",
          "whyItHelps",
          "impactCategory",
          "costTier",
          "setupMinutes",
        ],
      },
    },
    sustainableAlternatives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          replaces: { type: Type.STRING },
          detail: { type: Type.STRING },
          communityAngle: { type: Type.STRING },
          impactCategory: { type: Type.STRING, enum: [...IMPACT_CATEGORIES] },
          costTier: { type: Type.STRING, enum: [...COST_TIERS] },
        },
        required: [
          "id",
          "title",
          "replaces",
          "detail",
          "communityAngle",
          "impactCategory",
          "costTier",
        ],
      },
    },
    communityAdvisoryDraft: { type: Type.STRING },
  },
  required: [
    "headline",
    "mode",
    "routine",
    "indoorHacks",
    "sustainableAlternatives",
    "communityAdvisoryDraft",
  ],
};

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function getModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function createTextChunkStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const words = text.split(/(?<=\s)/);
  const chunkSize = 6;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let i = 0; i < words.length; i += chunkSize) {
          const piece = words.slice(i, i + chunkSize).join("");
          controller.enqueue(encoder.encode(piece));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

export async function generateActionPlan(
  airQuality: AirQualitySnapshot,
  profile: HouseholdProfile,
): Promise<ActionPlanResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return buildFallbackPlan(airQuality, profile);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const { systemInstruction, userPrompt } = buildPlanPrompts(
      airQuality,
      profile,
    );

    const response = await ai.models.generateContent({
      model: getModelName(),
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: ACTION_PLAN_JSON_SCHEMA,
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error("Empty Gemini response text");
    }

    const parsedJson = JSON.parse(rawText) as Record<string, unknown>;
    const validated = ActionPlanResponseSchema.safeParse({
      ...parsedJson,
      mode: "gemini",
    });

    if (!validated.success) {
      throw new Error("Gemini JSON did not match ActionPlanResponseSchema");
    }

    return validated.data;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown_error";
    console.warn(`[ClearDay] Falling back from Gemini plan generation: ${reason}`);
    return buildFallbackPlan(airQuality, profile);
  }
}

export async function streamCopilotReply(params: {
  airQuality: AirQualitySnapshot;
  profile: HouseholdProfile;
  adoptedTitles: string[];
  history: ChatMessage[];
  message: string;
}): Promise<{ stream: ReadableStream<Uint8Array>; mode: "gemini" | "fallback" }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const fallback = buildFallbackChatReply(params);
    return { stream: createTextChunkStream(fallback), mode: "fallback" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const { systemInstruction, contents } = buildChatPrompts(params);
    const responseStream = await ai.models.generateContentStream({
      model: getModelName(),
      contents,
      config: {
        systemInstruction,
        temperature: 0.4,
        maxOutputTokens: 700,
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          let emittedAny = false;
          for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
              emittedAny = true;
              controller.enqueue(encoder.encode(text));
            }
          }
          if (!emittedAny) {
            controller.enqueue(encoder.encode(buildFallbackChatReply(params)));
          }
          controller.close();
        } catch (streamErr) {
          const reason =
            streamErr instanceof Error ? streamErr.message : "stream_error";
          console.warn(`[ClearDay] Gemini stream interrupted: ${reason}`);
          controller.enqueue(
            encoder.encode("\n\n" + buildFallbackChatReply(params)),
          );
          controller.close();
        }
      },
    });

    return { stream, mode: "gemini" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown_error";
    console.warn(`[ClearDay] Falling back from Gemini chat: ${reason}`);
    return {
      stream: createTextChunkStream(buildFallbackChatReply(params)),
      mode: "fallback",
    };
  }
}
