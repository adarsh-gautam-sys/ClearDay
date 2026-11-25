import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SafeMessageContent } from "@/components/copilot/SafeMessageContent";
import { TopTelemetryRail } from "@/components/shell/TopTelemetryRail";
import { SmogAtmosphereCanvas } from "@/components/three/SmogAtmosphereCanvas";
import { buildPresetSnapshot, CITY_PRESETS } from "@/lib/air-quality/presets";

describe("Interactive & safety-focused UI components", () => {
  const snapshot = buildPresetSnapshot(CITY_PRESETS[0]!);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders SafeMessageContent bold spans and lists without injecting raw HTML", () => {
    const { container } = render(
      <SafeMessageContent
        content={
          "**Stay Indoors:** Run your filter.\n* Seal window drafts\n- Keep lids on pots\n<script>alert('xss')</script>"
        }
      />,
    );

    expect(screen.getByText("Stay Indoors:")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/<script>alert\('xss'\)<\/script>/)).toBeInTheDocument();
  });

  it("falls back to static gradient mode when WebGL or motion is unavailable", () => {
    const { container, rerender } = render(
      <SmogAtmosphereCanvas pm25={140} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveAttribute("data-mode", "static");

    const origMatchMedia = window.matchMedia;
    window.matchMedia = (q: string) => ({
      matches: q.includes("prefers-reduced-motion"),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });

    rerender(<SmogAtmosphereCanvas pm25={12} />);
    expect(wrapper).toHaveAttribute("data-mode", "static");
    window.matchMedia = origMatchMedia;
  });

  it("supports full keyboard navigation in TopTelemetryRail city combobox", async () => {
    const user = userEvent.setup();
    const onSelectLocation = vi.fn();

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
      <TopTelemetryRail
        airQuality={snapshot}
        aiMode="gemini"
        isLoadingAir={false}
        onSelectLocation={onSelectLocation}
        onResetAll={() => {}}
      />,
    );

    const combobox = screen.getByRole("combobox");
    await user.type(combobox, "Lo");

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    expect(combobox).toHaveAttribute("aria-activedescendant", "city-option-0");
    await user.keyboard("{ArrowDown}");
    expect(combobox).toHaveAttribute("aria-activedescendant", "city-option-1");

    await user.keyboard("{Enter}");
    expect(onSelectLocation).toHaveBeenCalledWith(
      expect.objectContaining({ name: "London" }),
    );
  });
});
