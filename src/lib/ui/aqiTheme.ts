import type { AqiBand, CostTier } from "../schemas";

export interface AqiVisualStyle {
  pillClass: string;
  strokeColor: string;
}

export const AQI_VISUAL_STYLE: Record<AqiBand, AqiVisualStyle> = {
  good: {
    pillClass: "bg-[#DCFCE7] text-[#166534] border-[#86EFAC]",
    strokeColor: "#15803D",
  },
  moderate: {
    pillClass: "bg-[#FEF9C3] text-[#854D0E] border-[#FDE047]",
    strokeColor: "#A16207",
  },
  sensitive: {
    pillClass: "bg-[#FFEDD5] text-[#9A3412] border-[#FDBA74]",
    strokeColor: "#C2410C",
  },
  unhealthy: {
    pillClass: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
    strokeColor: "#B91C1C",
  },
  very_unhealthy: {
    pillClass: "bg-[#F3E8FF] text-[#581C87] border-[#D8B4FE]",
    strokeColor: "#6B21A8",
  },
  hazardous: {
    pillClass: "bg-[#FECACA] text-[#7F1D1D] border-[#991B1B]",
    strokeColor: "#7F1D1D",
  },
};

export const COST_TIER_STYLE: Record<
  CostTier,
  { label: string; className: string }
> = {
  free: {
    label: "Free",
    className: "bg-[#E6F4F1] text-[#0F6E6E] border-[#B2DBD4]",
  },
  budget: {
    label: "Under $40",
    className: "bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]",
  },
  upgrade: {
    label: "Upgrade",
    className: "bg-[#ECE8DF] text-[#3F3F46] border-[#D8D2C5]",
  },
};
