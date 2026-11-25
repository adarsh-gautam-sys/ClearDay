import { NextResponse } from "next/server";
import { getAiProvider, hasGeminiKey } from "@/lib/ai/gemini";
import { getDistributedStore } from "@/lib/storage/distributedStore";

export async function GET(request: Request) {
  const store = getDistributedStore();
  const { searchParams } = new URL(request.url);
  const probe = searchParams.get("probe") === "1";

  const storeHealthy = probe && store.ping ? await store.ping() : true;
  const status = storeHealthy ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      store: store.backend,
      ...(probe ? { storeHealthy } : {}),
      aiMode: hasGeminiKey() ? "gemini" : "fallback",
      aiProvider: getAiProvider(),
      timestamp: new Date().toISOString(),
    },
    {
      status: storeHealthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
