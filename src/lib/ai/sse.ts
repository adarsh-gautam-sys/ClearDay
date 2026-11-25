export type ChatSseEvent =
  | { event: "meta"; data: { mode: "gemini" | "fallback"; medicalAlert: boolean } }
  | { event: "chunk"; data: { text: string } }
  | { event: "done"; data: { ok: true } }
  | { event: "error"; data: { message: string } };

/** Formats a single Server-Sent Event frame with JSON payload. */
export function formatSseEvent(frame: ChatSseEvent): string {
  return `event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`;
}

/**
 * Incrementally parses SSE event blocks from a decoded text buffer, returning
 * complete parsed events and any trailing incomplete frame fragment.
 */
export function parseSseBuffer(buffer: string): {
  events: ChatSseEvent[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: ChatSseEvent[] = [];

  for (const block of blocks) {
    if (!block.trim()) continue;
    let eventName = "message";
    const dataLines: string[] = [];

    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) continue;
    const rawData = dataLines.join("\n");

    try {
      const parsed = JSON.parse(rawData) as Record<string, unknown>;
      if (
        eventName === "meta" &&
        (parsed.mode === "gemini" || parsed.mode === "fallback") &&
        typeof parsed.medicalAlert === "boolean"
      ) {
        events.push({
          event: "meta",
          data: { mode: parsed.mode, medicalAlert: parsed.medicalAlert },
        });
      } else if (eventName === "chunk" && typeof parsed.text === "string") {
        events.push({ event: "chunk", data: { text: parsed.text } });
      } else if (eventName === "done") {
        events.push({ event: "done", data: { ok: true } });
      } else if (eventName === "error" && typeof parsed.message === "string") {
        events.push({ event: "error", data: { message: parsed.message } });
      }
    } catch {
      // Ignore malformed frame data rather than crashing the stream consumer.
    }
  }

  return { events, rest };
}
