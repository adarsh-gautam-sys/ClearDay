import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPresetSnapshot, CITY_PRESETS } from "@/lib/air-quality/presets";
import { buildFallbackPlan } from "@/lib/ai/fallbackPlan";
import { parseSseBuffer } from "@/lib/ai/sse";
import { DEFAULT_PROFILE } from "@/lib/schemas";

const { generateContentMock, generateContentStreamMock, clientOptionsLog } =
  vi.hoisted(() => ({
    generateContentMock: vi.fn(),
    generateContentStreamMock: vi.fn(),
    clientOptionsLog: [] as Array<Record<string, unknown>>,
  }));

vi.mock("@google/genai", () => {
  class MockGoogleGenAI {
    models = {
      generateContent: generateContentMock,
      generateContentStream: generateContentStreamMock,
    };

    constructor(options: Record<string, unknown>) {
      clientOptionsLog.push(options);
    }
  }

  return { GoogleGenAI: MockGoogleGenAI };
});

import {
  generateActionPlan,
  getAiProvider,
  hasGeminiKey,
  resetGenAiClientForTests,
  streamCopilotReply,
} from "@/lib/ai/gemini";

function clearAiEnv() {
  delete process.env.GOOGLE_GENAI_USE_VERTEXAI;
  delete process.env.VERTEX_API_KEY;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.FIRESTORE_PROJECT_ID;
  delete process.env.GOOGLE_CLOUD_LOCATION;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
}

describe("Gemini & Vertex AI client orchestration", () => {
  const snapshot = buildPresetSnapshot(CITY_PRESETS[0]!);

  beforeEach(() => {
    clearAiEnv();
    resetGenAiClientForTests();
    clientOptionsLog.length = 0;
    generateContentMock.mockReset();
    generateContentStreamMock.mockReset();
  });

  afterEach(() => {
    clearAiEnv();
    resetGenAiClientForTests();
    vi.restoreAllMocks();
  });

  it("selects AI provider cleanly across Vertex ADC, Vertex key, Gemini key, and fallback", () => {
    expect(getAiProvider()).toBe("fallback");
    expect(hasGeminiKey()).toBe(false);

    process.env.GEMINI_API_KEY = "AIzaTestKey123";
    expect(getAiProvider()).toBe("gemini-api-key");
    expect(hasGeminiKey()).toBe(true);

    process.env.GOOGLE_GENAI_USE_VERTEXAI = "true";
    process.env.GOOGLE_CLOUD_PROJECT = "clearday-air-pw6";
    expect(getAiProvider()).toBe("vertex-adc");

    process.env.VERTEX_API_KEY = "vtx-key-456";
    expect(getAiProvider()).toBe("vertex-api-key");
  });

  it("generates validated Gemini action plans via Vertex AI ADC and falls back on malformed JSON", async () => {
    process.env.GOOGLE_GENAI_USE_VERTEXAI = "true";
    process.env.GOOGLE_CLOUD_PROJECT = "clearday-air-pw6";

    const validPlan = {
      ...buildFallbackPlan(snapshot, DEFAULT_PROFILE),
      headline: "Live Vertex AI plan tailored for severe Delhi winter inversion.",
      mode: "gemini",
    };

    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify(validPlan),
    });

    const livePlan = await generateActionPlan(snapshot, DEFAULT_PROFILE);
    expect(livePlan.mode).toBe("gemini");
    expect(livePlan.headline).toContain("Live Vertex AI plan");
    expect(clientOptionsLog[0]).toMatchObject({
      vertexai: true,
      project: "clearday-air-pw6",
      location: "global",
    });

    vi.spyOn(console, "warn").mockImplementation(() => {});
    generateContentMock.mockResolvedValueOnce({ text: "{not valid json" });
    const degradedPlan = await generateActionPlan(snapshot, DEFAULT_PROFILE);
    expect(degradedPlan.mode).toBe("fallback");
  });

  it("streams live SSE chunks, falls back when stream is empty, and stops cleanly on abort", async () => {
    process.env.GEMINI_API_KEY = "AIzaTestKey123";

    async function* fakeChunks() {
      yield { text: "**Window:** Stay indoors " };
      yield { text: "until midday." };
    }
    generateContentStreamMock.mockResolvedValueOnce(fakeChunks());

    const { stream, mode } = await streamCopilotReply({
      airQuality: snapshot,
      profile: DEFAULT_PROFILE,
      adoptedTitles: ["HEPA"],
      history: [],
      message: "When should kids step outside?",
      medicalAlert: false,
    });
    expect(mode).toBe("gemini");

    const rawSse = await new Response(stream).text();
    const { events } = parseSseBuffer(rawSse);
    expect(events[0]).toEqual({
      event: "meta",
      data: { mode: "gemini", medicalAlert: false },
    });
    expect(
      events
        .filter((e) => e.event === "chunk")
        .map((e) => e.data.text)
        .join(""),
    ).toBe("**Window:** Stay indoors until midday.");
    expect(events[events.length - 1]).toEqual({
      event: "done",
      data: { ok: true },
    });

    // Empty upstream stream emits deterministic fallback reply
    async function* emptyChunks() {
      yield { text: "" };
    }
    generateContentStreamMock.mockResolvedValueOnce(emptyChunks());
    const emptyRes = await streamCopilotReply({
      airQuality: snapshot,
      profile: DEFAULT_PROFILE,
      adoptedTitles: [],
      history: [],
      message: "Draft a WhatsApp notice",
    });
    const emptyText = await new Response(emptyRes.stream).text();
    expect(emptyText).toContain("Smog Notice");

    // Pre-aborted signal terminates stream without emitting fallback chunks
    const abortCtrl = new AbortController();
    abortCtrl.abort();
    async function* slowChunks() {
      yield { text: "chunk-after-abort" };
    }
    generateContentStreamMock.mockResolvedValueOnce(slowChunks());
    const abortedRes = await streamCopilotReply({
      airQuality: snapshot,
      profile: DEFAULT_PROFILE,
      adoptedTitles: [],
      history: [],
      message: "Status check",
      signal: abortCtrl.signal,
    });
    const abortedText = await new Response(abortedRes.stream).text();
    expect(abortedText).not.toContain("chunk-after-abort");
  });
});
