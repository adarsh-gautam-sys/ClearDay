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
import { formatSseEvent } from "./sse";

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

const GEMINI_PLAN_TIMEOUT_MS = 15_000;

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

function getGenAiClient(apiKey: string): GoogleGenAI {
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedApiKey = apiKey;
  }
  return cachedClient;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Gemini request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function getModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function createSseFallbackStream(
  text: string,
  medicalAlert: boolean,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const words = text.split(/(?<=\s)/);
  const chunkSize = 6;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            formatSseEvent({
              event: "meta",
              data: { mode: "fallback", medicalAlert },
            }),
          ),
        );
        for (let i = 0; i < words.length; i += chunkSize) {
          const piece = words.slice(i, i + chunkSize).join("");
          controller.enqueue(
            encoder.encode(
              formatSseEvent({ event: "chunk", data: { text: piece } }),
            ),
          );
        }
        controller.enqueue(
          encoder.encode(
            formatSseEvent({ event: "done", data: { ok: true } }),
          ),
        );
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
    const ai = getGenAiClient(apiKey);
    const { systemInstruction, userPrompt } = buildPlanPrompts(
      airQuality,
      profile,
    );

    const response = await withTimeout(
      ai.models.generateContent({
        model: getModelName(),
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema: ACTION_PLAN_JSON_SCHEMA,
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      }),
      GEMINI_PLAN_TIMEOUT_MS,
    );

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
  medicalAlert?: boolean;
}): Promise<{ stream: ReadableStream<Uint8Array>; mode: "gemini" | "fallback" }> {
  const medicalAlert = Boolean(params.medicalAlert);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const fallback = buildFallbackChatReply(params);
    return {
      stream: createSseFallbackStream(fallback, medicalAlert),
      mode: "fallback",
    };
  }

  try {
    const ai = getGenAiClient(apiKey);
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
          controller.enqueue(
            encoder.encode(
              formatSseEvent({
                event: "meta",
                data: { mode: "gemini", medicalAlert },
              }),
            ),
          );

          let emittedAny = false;
          for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
              emittedAny = true;
              controller.enqueue(
                encoder.encode(
                  formatSseEvent({ event: "chunk", data: { text } }),
                ),
              );
            }
          }
          if (!emittedAny) {
            controller.enqueue(
              encoder.encode(
                formatSseEvent({
                  event: "chunk",
                  data: { text: buildFallbackChatReply(params) },
                }),
              ),
            );
          }
          controller.enqueue(
            encoder.encode(
              formatSseEvent({ event: "done", data: { ok: true } }),
            ),
          );
          controller.close();
        } catch (streamErr) {
          const reason =
            streamErr instanceof Error ? streamErr.message : "stream_error";
          console.warn(`[ClearDay] Gemini stream interrupted: ${reason}`);
          controller.enqueue(
            encoder.encode(
              formatSseEvent({
                event: "chunk",
                data: { text: "\n\n" + buildFallbackChatReply(params) },
              }),
            ),
          );
          controller.enqueue(
            encoder.encode(
              formatSseEvent({ event: "done", data: { ok: true } }),
            ),
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
      stream: createSseFallbackStream(
        buildFallbackChatReply(params),
        medicalAlert,
      ),
      mode: "fallback",
    };
  }
}
