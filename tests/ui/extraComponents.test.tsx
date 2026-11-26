import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import GlobalError from "@/app/error";
import LoadingWorkspace from "@/app/loading";
import HomePage from "@/app/page";
import { HourlySmogChart } from "@/components/air/HourlySmogChart";
import { ImpactLedger } from "@/components/impact/ImpactLedger";
import { HouseholdProfileBar } from "@/components/profile/HouseholdProfileBar";
import { BlurText } from "@/components/reactbits/BlurText";
import { CountUp } from "@/components/reactbits/CountUp";
import { ShinyText } from "@/components/reactbits/ShinyText";
import { SpotlightCard } from "@/components/reactbits/SpotlightCard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { buildPresetSnapshot, CITY_PRESETS } from "@/lib/air-quality/presets";
import { calculateImpact } from "@/lib/impact/calculator";
import { DEFAULT_PROFILE } from "@/lib/schemas";

describe("Extended UI, App Router & impact presentation coverage", () => {
  const snapshot = buildPresetSnapshot(CITY_PRESETS[0]!);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates scope, sensitive groups, and domestic selectors in HouseholdProfileBar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<HouseholdProfileBar profile={DEFAULT_PROFILE} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Community" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ scope: "community" }),
    );

    await user.click(screen.getByRole("button", { name: "Asthma" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ vulnerabilities: ["children", "asthma"] }),
    );

    await user.selectOptions(screen.getByLabelText("Air Filtration"), "diy_box");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ purifier: "diy_box" }),
    );
  });

  it("renders HourlySmogChart interactive table view with screen-reader caption and handles empty series", async () => {
    const user = userEvent.setup();
    const onScrub = vi.fn();

    const { rerender } = render(
      <HourlySmogChart
        hourly={snapshot.hourly}
        strokeColor="#B91C1C"
        cityName="New Delhi"
        onScrubPm25={onScrub}
      />,
    );

    await user.click(screen.getByRole("button", { name: /24h Table View/i }));
    const table = screen.getByRole("table");
    expect(
      within(table).getByText(/24-hour winter PM2\.5 and US AQI forecast for New Delhi/i),
    ).toBeInTheDocument();

    rerender(
      <HourlySmogChart hourly={[]} strokeColor="#15803D" cityName="Empty City" />,
    );
    expect(screen.getAllByText(/Empty City/i).length).toBeGreaterThan(0);
  });

  it("displays accessible progressbar and plain-English Direct Impact Summary in ImpactLedger", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    const activeImpact = calculateImpact({
      currentPm25: 180,
      purifier: "diy_box",
      selectedCategories: ["diy_corsi_box", "car_to_transit"],
      communityHouseholds: 50,
    });

    const { rerender } = render(
      <TooltipProvider>
        <ImpactLedger
          impact={activeImpact}
          adoptedCount={2}
          communityHouseholds={50}
          onHouseholdsChange={() => {}}
        />
      </TooltipProvider>,
    );

    const progress = screen.getByRole("progressbar", {
      name: /Estimated indoor PM2.5 remaining/i,
    });
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
    expect(
      screen.getByText(/Your 2 adopted choices cut estimated indoor PM2\.5/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Copy Summary/i }));
    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/Direct impact summary copied to clipboard\./i),
    ).toBeInTheDocument();

    const zeroImpact = calculateImpact({
      currentPm25: 100,
      purifier: "none",
      selectedCategories: [],
      communityHouseholds: 1,
    });
    rerender(
      <TooltipProvider>
        <ImpactLedger
          impact={zeroImpact}
          adoptedCount={0}
          communityHouseholds={1}
          onHouseholdsChange={() => {}}
        />
      </TooltipProvider>,
    );
    expect(
      screen.getByText(/Adopt actions from your plan to drop estimated indoor PM2\.5/i),
    ).toBeInTheDocument();
  });

  it("renders ReactBits helpers, App Router error/loading boundaries, and HomePage SSR tree", async () => {
    const user = userEvent.setup();
    const resetFn = vi.fn();

    render(
      <div>
        <CountUp to={42.5} decimals={1} prefix="-" suffix="%" />
        <SpotlightCard>
          <span>Spotlit Content</span>
        </SpotlightCard>
        <BlurText text="Headline Copy" animateKey="k1" />
        <ShinyText text="GEMINI LIVE" />
        <LoadingWorkspace />
        <GlobalError error={new Error("boom")} reset={resetFn} />
      </div>,
    );

    const countNodes = screen.getAllByText("-42.5%");
    expect(countNodes[0]).toHaveClass("sr-only");
    expect(countNodes[1]).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Spotlit Content")).toBeInTheDocument();
    expect(screen.getByText("Headline Copy")).toBeInTheDocument();
    expect(screen.getByText("GEMINI LIVE")).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: /Loading live urban air quality telemetry/i,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Try Again/i }));
    expect(resetFn).toHaveBeenCalledTimes(1);

    // Server Component HomePage resolves telemetry + plan cleanly on offline network
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const tree = await HomePage();
    render(tree);
    expect(screen.getByRole("heading", { name: /New Delhi, India/i })).toBeInTheDocument();
  });
});
