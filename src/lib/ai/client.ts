import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";

export type AiProvider =
  | "vertex-adc"
  | "vertex-api-key"
  | "gemini-api-key"
  | "fallback";

let cachedClient: GoogleGenAI | null = null;
let cachedClientSignature: string | null = null;

function hashSecret(secret: string): string {
  if (!secret) return "none";
  return createHash("sha256").update(secret).digest("hex").slice(0, 12);
}

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

export function getModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview";
}

export function resetGenAiClientForTests(): void {
  cachedClient = null;
  cachedClientSignature = null;
}

export function getGenAiClient(): GoogleGenAI | null {
  const provider = getAiProvider();
  if (provider === "fallback") return null;

  const project =
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.FIRESTORE_PROJECT_ID?.trim() ||
    "";
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "global";
  const vertexKey = process.env.VERTEX_API_KEY?.trim() || "";
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || "";

  const signature = `${provider}:${project}:${location}:${hashSecret(vertexKey)}:${hashSecret(geminiKey)}`;
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
