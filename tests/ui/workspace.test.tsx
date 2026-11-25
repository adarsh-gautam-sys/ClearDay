import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClearDayWorkspace } from "@/components/ClearDayWorkspace";
import { buildFallbackPlan } from "@/lib/ai/fallbackPlan";
import { formatSseEvent } from "@/lib/ai/sse";
import { buildPresetSnapshot, CITY_PRESETS } from "@/lib/air-quality/presets";
import { DEFAULT_PROFILE } from "@/lib/schemas";

describe("ClearDayWorkspace UI flows", () => {
  const snapshot = buildPresetSnapshot(CITY_PRESETS[0]!);
  const plan = buildFallbackPlan(snapshot, DEFAULT_PROFILE);

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats Western hemisphere coordinates accurately", () => {
    const slcPreset = CITY_PRESETS.find((p) => p.id === "salt-lake-city")!;
    const slcSnapshot = buildPresetSnapshot(slcPreset);
    const slcPlan = buildFallbackPlan(slcSnapshot, DEFAULT_PROFILE);

    render(
      <ClearDayWorkspace initialAirQuality={slcSnapshot} initialPlan={slcPlan} />,
    );

    expect(screen.getByText(/40\.76°N, 111\.89°W/)).toBeInTheDocument();
  });

  it("toggles 3D Outdoor vs Inside Plan view, switches Radix tabs, adopts actions synchronously, moves Radix slider via keyboard, and closes Radix dialog via Escape", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(
      <ClearDayWorkspace initialAirQuality={snapshot} initialPlan={plan} />,
    );

    expect(screen.getByText(/2 active/i)).toBeInTheDocument();

    // Toggle Interactive Atmosphere View from Outdoor to Inside Plan
    await user.click(screen.getByRole("button", { name: /Inside Plan/i }));
    expect(screen.getByText(/filtered indoor air/i)).toBeInTheDocument();

    // Switch to 02 Indoor Hacks and expand setup steps
    await user.click(screen.getByRole("tab", { name: /Indoor Hacks/i }));
    const stepButton = screen.getAllByRole("button", {
      name: /setup steps/i,
    })[0]!;
    await user.click(stepButton);
    expect(screen.getByRole("list")).toBeInTheDocument();

    // Adopt an additional hack -> synchronous Impact Ledger update without fetch
    const adoptButtons = screen.getAllByRole("button", {
      name: /Adopt Today/i,
    });
    await user.click(adoptButtons[0]!);
    expect(screen.getByText(/3 active/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Switch to 03 Sustainable Swaps -> shareable draft visible
    await user.click(screen.getByRole("tab", { name: /Sustainable Swaps/i }));
    expect(
      screen.getByText(/SHAREABLE COMMUNITY ADVISORY DRAFT/i),
    ).toBeInTheDocument();

    // Adjust Radix Community Scale Multiplier slider via keyboard
    const slider = screen.getByRole("slider", {
      name: /Community Scale Multiplier/i,
    });
    act(() => {
      slider.focus();
    });
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText(/26 households/i)).toBeInTheDocument();

    // Open Radix Methodology dialog and close with Escape
    await user.click(screen.getByRole("button", { name: /Methodology/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("streams formatted SSE Smog Copilot reply (bold + bullets) and surfaces medical emergency banner", async () => {
    const user = userEvent.setup();
    const encoder = new TextEncoder();
    const ssePayload =
      formatSseEvent({
        event: "meta",
        data: { mode: "fallback", medicalAlert: true },
      }) +
      formatSseEvent({
        event: "chunk",
        data: {
          text: "**Action:** Seek immediate emergency care.\n* Stay indoors and keep calm.",
        },
      }) +
      formatSseEvent({ event: "done", data: { ok: true } });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "X-Medical-Alert": "true",
        },
      }),
    );

    render(
      <ClearDayWorkspace initialAirQuality={snapshot} initialPlan={plan} />,
    );

    const input = screen.getByLabelText(/Ask ClearDay Smog Copilot/i);
    await user.type(input, "I have chest pain in this smog");
    await user.click(screen.getByRole("button", { name: /^Ask$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Seek immediate emergency care\./i),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Action:")).toBeInTheDocument();
    expect(
      screen.getByText(/Stay indoors and keep calm\./i).tagName,
    ).toBe("LI");
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Emergency Medical Notice/i,
    );
  });
});
