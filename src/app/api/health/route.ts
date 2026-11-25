import { NextResponse } from "next/server";
import { hasGeminiKey } from "@/lib/ai/gemini";
import { getDistributedStore } from "@/lib/storage/distributedStore";

export async function GET() {
  const store = getDistributedStore();

  return NextResponse.json(
    {
      status: "ok",
      store: store.backend,
      aiMode: hasGeminiKey() ? "gemini" : "fallback",
      timestamp: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
