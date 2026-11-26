import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClearDayWorkspace } from "@/components/ClearDayWorkspace";
import { AgentStatus } from "@/components/copilot/AgentStatus";
import { buildFallbackPlan } from "@/lib/ai/fallbackPlan";
import { buildPresetSnapshot, CITY_PRESETS } from "@/lib/air-quality/presets";
import { DEFAULT_PROFILE } from "@/lib/schemas";

describe("Accessibility & ThinkingOrb lifecycle", () => {
  const snapshot = buildPresetSnapshot(CITY_PRESETS[0]!);
  const plan = buildFallbackPlan(snapshot, DEFAULT_PROFILE);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("has zero axe-core violations (including landmark regions & open combobox) across workspace views and Radix portal", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [
            {
              name: "Lahore",
              country: "Pakistan",
              latitude: 31.55,
              longitude: 74.35,
              timezone: "Asia/Karachi",
            },
            {
              name: "London",
              country: "United Kingdom",
              latitude: 51.5,
              longitude: -0.12,
              timezone: "Europe/London",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    render(
      <ClearDayWorkspace initialAirQuality={snapshot} initialPlan={plan} />,
    );

    const axeOptions = {
      rules: {
        // jsdom does not compute visual CSS background/foreground contrast
        "color-contrast": { enabled: false },
      },
    };

    const defaultAudit = await axe.run(document.body, axeOptions);
    expect(defaultAudit.violations).toEqual([]);

    // Open CitySearchCombobox listbox and verify single-select ARIA compliance
    await user.type(
      screen.getByRole("combobox", { name: /Search city for local air quality/i }),
      "La",
    );
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    const comboboxAudit = await axe.run(document.body, axeOptions);
    expect(comboboxAudit.violations).toEqual([]);
    await user.keyboard("{Escape}");

    // Switch to 03 Sustainable Swaps tab (verifies live tabpanel landmarks)
    await user.click(screen.getByRole("tab", { name: /Sustainable Swaps/i }));
    const swapsAudit = await axe.run(document.body, axeOptions);
    expect(swapsAudit.violations).toEqual([]);

    // Toggle 24h Table View
    await user.click(screen.getByRole("button", { name: /24h Table View/i }));
    const tableAudit = await axe.run(document.body, axeOptions);
    expect(tableAudit.violations).toEqual([]);

    // Open Radix Methodology dialog (Portal)
    await user.click(screen.getByRole("button", { name: /Methodology/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const modalAudit = await axe.run(document.body, axeOptions);
    expect(modalAudit.violations).toEqual([]);
  }, 20_000);

  it("mounts ThinkingOrb live status during active phases and unmounts when idle or done", () => {
    const { rerender } = render(
      <AgentStatus phase="reasoning" label="Reviewing local telemetry…" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Reviewing local telemetry…",
    );

    rerender(<AgentStatus phase="idle" label="Idle" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(<AgentStatus phase="done" label="Done" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
