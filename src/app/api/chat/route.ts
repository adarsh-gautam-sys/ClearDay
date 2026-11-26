import { NextResponse } from "next/server";
import { streamCopilotReply } from "@/lib/ai/gemini";
import { detectRespiratoryEmergency } from "@/lib/ai/safety";
import { ChatRequestSchema } from "@/lib/schemas";
import {
  DEFAULT_MAX_JSON_BYTES,
  enforceRateLimit,
  formatValidationErrors,
  readBoundedJson,
  verifySameOrigin,
  withApiErrorHandling,
} from "@/lib/security/http";
import { getDistributedStore } from "@/lib/storage/distributedStore";

export async function POST(request: Request) {
  return withApiErrorHandling("/api/chat", request, async (req) => {
    const originResponse = verifySameOrigin(req);
    if (originResponse) return originResponse;

    const store = getDistributedStore();
    const rateLimitResponse = await enforceRateLimit(
      req,
      "/api/chat",
      20,
      60,
      "Too many Copilot questions. Please wait a minute.",
      store,
    );
    if (rateLimitResponse) return rateLimitResponse;

    const bodyResult = await readBoundedJson(req, DEFAULT_MAX_JSON_BYTES);
    if (!bodyResult.ok) {
      return NextResponse.json(
        { error: bodyResult.error },
        { status: bodyResult.status },
      );
    }

    const parsed = ChatRequestSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid chat payload.",
          issues: formatValidationErrors(parsed.error.issues),
        },
        { status: 400 },
      );
    }

    const emergency = detectRespiratoryEmergency(parsed.data.message);
    const { stream, mode } = await streamCopilotReply({
      ...parsed.data,
      medicalAlert: emergency.isEmergency,
      signal: req.signal,
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-AI-Mode": mode,
        "X-Medical-Alert": emergency.isEmergency ? "true" : "false",
        "X-Store-Backend": store.backend,
      },
    });
  });
}
