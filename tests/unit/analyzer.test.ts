import { describe, expect, it } from "vitest";
import { classifyUsAqi, detectSmogWindows } from "@/lib/air-quality/analyzer";
import type { HourlyPoint } from "@/lib/schemas";

describe("classifyUsAqi", () => {
  it("classifies standard US EPA AQI breakpoints accurately", () => {
    expect(classifyUsAqi(0).band).toBe("good");
    expect(classifyUsAqi(50).band).toBe("good");
    expect(classifyUsAqi(51).band).toBe("moderate");
    expect(classifyUsAqi(100).band).toBe("moderate");
    expect(classifyUsAqi(101).band).toBe("sensitive");
    expect(classifyUsAqi(150).band).toBe("sensitive");
    expect(classifyUsAqi(151).band).toBe("unhealthy");
    expect(classifyUsAqi(200).band).toBe("unhealthy");
    expect(classifyUsAqi(201).band).toBe("very_unhealthy");
    expect(classifyUsAqi(300).band).toBe("very_unhealthy");
    expect(classifyUsAqi(301).band).toBe("hazardous");
    expect(classifyUsAqi(485).band).toBe("hazardous");
  });

  it("handles negative or NaN values safely", () => {
    expect(classifyUsAqi(-15).band).toBe("good");
    expect(classifyUsAqi(Number.NaN).band).toBe("good");
  });
});

describe("detectSmogWindows", () => {
  it("identifies cleanest 2h ventilation window and 3h peak inversion window", () => {
    const hourly: HourlyPoint[] = [
      { time: "2026-11-21T06:00", hourLabel: "06:00", usAqi: 240, pm25: 190 },
      { time: "2026-11-21T07:00", hourLabel: "07:00", usAqi: 265, pm25: 215 },
      { time: "2026-11-21T08:00", hourLabel: "08:00", usAqi: 255, pm25: 205 },
      { time: "2026-11-21T13:00", hourLabel: "13:00", usAqi: 90, pm25: 30 },
      { time: "2026-11-21T14:00", hourLabel: "14:00", usAqi: 84, pm25: 28 },
      { time: "2026-11-21T20:00", hourLabel: "20:00", usAqi: 210, pm25: 160 },
    ];

    const windows = detectSmogWindows(hourly);
    expect(windows.bestVentilation.startLabel).toBe("13:00");
    expect(windows.bestVentilation.endLabel).toBe("14:00");
    expect(windows.bestVentilation.avgPm25).toBe(29);
    expect(windows.bestVentilation.recommended).toBe(true);

    expect(windows.peakHazard.startLabel).toBe("06:00");
    expect(windows.peakHazard.endLabel).toBe("08:00");
    expect(windows.peakHazard.avgPm25).toBe(203.3);
  });

  it("marks ventilation as not recommended when all hours exceed 55 µg/m³", () => {
    const severe: HourlyPoint[] = [
      { time: "2026-11-21T08:00", hourLabel: "08:00", usAqi: 310, pm25: 240 },
      { time: "2026-11-21T14:00", hourLabel: "14:00", usAqi: 210, pm25: 140 },
      { time: "2026-11-21T15:00", hourLabel: "15:00", usAqi: 205, pm25: 136 },
    ];

    const windows = detectSmogWindows(severe);
    expect(windows.bestVentilation.recommended).toBe(false);
    expect(windows.bestVentilation.avgPm25).toBe(138);
    expect(windows.bestVentilation.guidance.toLowerCase()).toContain("sealed");
  });

  it("handles empty hourly input gracefully", () => {
    const windows = detectSmogWindows([]);
    expect(windows.bestVentilation.recommended).toBe(false);
    expect(windows.peakHazard.startLabel).toBe("07:00");
  });
});
