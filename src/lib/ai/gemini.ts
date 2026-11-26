import { logWarn } from "../observability/logger";
import {
  ActionPlanResponseSchema,
  type ActionPlanResponse,
  type AirQualitySnapshot,
  type ChatMessage,
  type HouseholdProfile,
} from "../schemas";
import { ACTION_PLAN_JSON_SCHEMA } from "./actionPlanSchema";
import { getGenAiClient, getModelName } from "./client";
import { buildFallbackChatReply } from "./fallbackChat";
import { buildFallbackPlan } from "./fallbackPlan";
import { buildChatPrompts, buildPlanPrompts } from "./prompts";
import { formatSseEvent } from "./sse";

export {
  type AiProvider,
  getAiProvider,
  hasGeminiKey,
  resetGenAiClientForTests,
} from "./client";

const GEMINI_PLAN_TIMEOUT_MS = 15_000;
const SSE_ENCODER = new TextEncoder();

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

function encodeSse(
  event: Parameters<typeof formatSseEvent>[0],
): Uint8Array {
  return SSE_ENCODER.encode(formatSseEvent(event));
}

function createSseFallbackStream(
  text: string,
  medicalAlert: boolean,
): ReadableStream<Uint8Array> {
  const words = text.split(/(?<=\s)/);
  const chunkSize = 6;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encodeSse({
          event: "meta",
          data: { mode: "fallback", medicalAlert },
        }),
      );
      for (let i = 0; i < words.length; i += chunkSize) {
        const piece = words.slice(i, i + chunkSize).join("");
        controller.enqueue(encodeSse({ event: "chunk", data: { text: piece } }));
      }
      controller.enqueue(encodeSse({ event: "done", data: { ok: true } }));
      controller.close();
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
    logWarn("GeminiPlan", "Falling back from Gemini plan generation", { reason });
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
  signal?: AbortSignal;
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

    let cancelled = false;
    const isStopped = () => cancelled || Boolean(params.signal?.aborted);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(
            encodeSse({
              event: "meta",
              data: { mode: "gemini", medicalAlert },
            }),
          );

          let emittedAny = false;
          for await (const chunk of responseStream) {
            if (isStopped()) break;
            const text = chunk.text;
            if (text) {
              emittedAny = true;
              controller.enqueue(encodeSse({ event: "chunk", data: { text } }));
            }
          }

          if (isStopped()) {
            controller.close();
            return;
          }

          if (!emittedAny) {
            controller.enqueue(
              encodeSse({
                event: "chunk",
                data: { text: buildFallbackChatReply(params) },
              }),
            );
          }
          controller.enqueue(encodeSse({ event: "done", data: { ok: true } }));
          controller.close();
        } catch (streamErr) {
          if (isStopped()) {
            return;
          }
          const reason =
            streamErr instanceof Error ? streamErr.message : "stream_error";
          logWarn("GeminiChat", "Gemini stream interrupted", { reason });
          controller.enqueue(
            encodeSse({
              event: "chunk",
              data: { text: "\n\n" + buildFallbackChatReply(params) },
            }),
          );
          controller.enqueue(encodeSse({ event: "done", data: { ok: true } }));
          controller.close();
        }
      },
      cancel() {
        cancelled = true;
      },
    });

    return { stream, mode: "gemini" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown_error";
    logWarn("GeminiChat", "Falling back from Gemini chat", { reason });
    return {
      stream: createSseFallbackStream(
        buildFallbackChatReply(params),
        medicalAlert,
      ),
      mode: "fallback",
    };
  }
}
