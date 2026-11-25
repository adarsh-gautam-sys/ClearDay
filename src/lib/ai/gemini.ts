import { GoogleGenAI } from "@google/genai";
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

export type AiProvider =
  | "vertex-adc"
  | "vertex-api-key"
  | "gemini-api-key"
  | "fallback";

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

// Standard lowercase JSON Schema works uniformly across both Vertex AI and Gemini Developer API.
const ACTION_PLAN_JSON_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    mode: { type: "string", enum: ["gemini", "fallback"] },
    routine: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          timeWindow: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          whyItHelps: { type: "string" },
          impactCategory: { type: "string", enum: [...IMPACT_CATEGORIES] },
          costTier: { type: "string", enum: [...COST_TIERS] },
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
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          steps: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: { type: "string" },
          },
          whyItHelps: { type: "string" },
          impactCategory: { type: "string", enum: [...IMPACT_CATEGORIES] },
          costTier: { type: "string", enum: [...COST_TIERS] },
          setupMinutes: { type: "integer" },
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
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          replaces: { type: "string" },
          detail: { type: "string" },
          communityAngle: { type: "string" },
          impactCategory: { type: "string", enum: [...IMPACT_CATEGORIES] },
          costTier: { type: "string", enum: [...COST_TIERS] },
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
    communityAdvisoryDraft: { type: "string" },
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
let cachedClientSignature: string | null = null;

export function getAiProvider(): AiProvider {
  const useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI?.trim() === "true";
  const vertexKey = process.env.VERTEX_API_KEY?.trim();
  const project =
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.FIRESTORE_PROJECT_ID?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  if (useVertex) {
    if (vertexKey) return "vertex-api-key";
    if (project) return "vertex-adc";
  }
  if (vertexKey) return "vertex-api-key";
  if (geminiKey) return "gemini-api-key";
  return "fallback";
}

export function hasGeminiKey(): boolean {
  return getAiProvider() !== "fallback";
}

function getGenAiClient(): GoogleGenAI | null {
  const provider = getAiProvider();
  if (provider === "fallback") return null;

  const project =
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.FIRESTORE_PROJECT_ID?.trim() ||
    "";
  const location =
    process.env.GOOGLE_CLOUD_LOCATION?.trim() || "global";
  const vertexKey = process.env.VERTEX_API_KEY?.trim() || "";
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || "";

  const signature = `${provider}:${project}:${location}:${vertexKey.slice(0, 8)}:${geminiKey.slice(0, 8)}`;
  if (cachedClient && cachedClientSignature === signature) {
    return cachedClient;
  }

  if (provider === "vertex-api-key") {
    cachedClient = new GoogleGenAI({ vertexai: true, apiKey: vertexKey });
  } else if (provider === "vertex-adc") {
    cachedClient = new GoogleGenAI({ vertexai: true, project, location });
  } else {
    cachedClient = new GoogleGenAI({ apiKey: geminiKey });
  }
  cachedClientSignature = signature;
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

function getModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview";
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
  const ai = getGenAiClient();
  if (!ai) {
    return buildFallbackPlan(airQuality, profile);
  }

  try {
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
          maxOutputTokens: 3072,
          thinkingConfig: { thinkingBudget: 0 },
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
  const ai = getGenAiClient();
  if (!ai) {
    const fallback = buildFallbackChatReply(params);
    return {
      stream: createSseFallbackStream(fallback, medicalAlert),
      mode: "fallback",
    };
  }

  try {
    const { systemInstruction, contents } = buildChatPrompts(params);
    const responseStream = await ai.models.generateContentStream({
      model: getModelName(),
      contents,
      config: {
        systemInstruction,
        temperature: 0.4,
        maxOutputTokens: 800,
        thinkingConfig: { thinkingBudget: 0 },
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
