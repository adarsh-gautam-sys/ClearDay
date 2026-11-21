import { NextResponse } from "next/server";
import { streamCopilotReply } from "@/lib/ai/gemini";
import { detectRespiratoryEmergency } from "@/lib/ai/safety";
import { ChatRequestSchema } from "@/lib/schemas";
import { getClientIp, SlidingWindowRateLimiter } from "@/lib/security/rateLimit";

const chatRateLimiter = new SlidingWindowRateLimiter(20, 60_000);

export function resetChatRateLimit(): void {
  chatRateLimiter.clear();
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = chatRateLimiter.check(`${ip}:/api/chat`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many Copilot questions. Please wait a minute." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid chat payload.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const emergency = detectRespiratoryEmergency(parsed.data.message);
  const { stream, mode } = await streamCopilotReply(parsed.data);

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-AI-Mode": mode,
      "X-Medical-Alert": emergency.isEmergency ? "true" : "false",
    },
  });
}
