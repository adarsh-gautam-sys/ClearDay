import { NextResponse } from "next/server";
import { streamCopilotReply } from "@/lib/ai/gemini";
import { detectRespiratoryEmergency } from "@/lib/ai/safety";
import { ChatRequestSchema } from "@/lib/schemas";
import {
  DEFAULT_MAX_JSON_BYTES,
  formatValidationErrors,
  readBoundedJson,
} from "@/lib/security/http";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { getDistributedStore } from "@/lib/storage/distributedStore";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const store = getDistributedStore();
  const limit = await checkRateLimit(`${ip}:/api/chat`, 20, 60, store);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many Copilot questions. Please wait a minute." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  const bodyResult = await readBoundedJson(request, DEFAULT_MAX_JSON_BYTES);
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
}
