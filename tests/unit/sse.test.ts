import { describe, expect, it } from "vitest";
import { formatSseEvent, parseSseBuffer } from "@/lib/ai/sse";

describe("SSE formatting and incremental parsing", () => {
  it("parses complete and fragmented SSE frames across chunk boundaries", () => {
    const frame1 = formatSseEvent({
      event: "meta",
      data: { mode: "fallback", medicalAlert: true },
    });
    const frame2 = formatSseEvent({
      event: "chunk",
      data: { text: "Stay indoors " },
    });
    const frame3 = formatSseEvent({
      event: "done",
      data: { ok: true },
    });

    const combined = frame1 + frame2 + frame3;
    const splitAt = Math.floor(combined.length / 2);
    const partA = combined.slice(0, splitAt);
    const partB = combined.slice(splitAt);

    const firstPass = parseSseBuffer(partA);
    expect(firstPass.rest.length).toBeGreaterThan(0);

    const secondPass = parseSseBuffer(firstPass.rest + partB);
    const allEvents = [...firstPass.events, ...secondPass.events];

    expect(secondPass.rest).toBe("");
    expect(allEvents).toEqual([
      { event: "meta", data: { mode: "fallback", medicalAlert: true } },
      { event: "chunk", data: { text: "Stay indoors " } },
      { event: "done", data: { ok: true } },
    ]);
  });
});
