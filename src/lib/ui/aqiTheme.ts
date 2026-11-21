import type { AqiBand, CostTier } from "../schemas";

export interface AqiVisualStyle {
  pillClass: string;
  barClass: string;
  dotClass: string;
  strokeColor: string;
  shortTag: string;
}

export const AQI_VISUAL_STYLE: Record<AqiBand, AqiVisualStyle> = {
  good: {
    pillClass: "bg-[#DCFCE7] text-[#166534] border-[#86EFAC]",
    barClass: "bg-[#15803D]",
    dotClass: "bg-[#166534]",
    strokeColor: "#15803D",
    shortTag: "LOW RISK",
  },
  moderate: {
    pillClass: "bg-[#FEF9C3] text-[#854D0E] border-[#FDE047]",
    barClass: "bg-[#CA8A04]",
    dotClass: "bg-[#854D0E]",
    strokeColor: "#A16207",
    shortTag: "MODERATE",
  },
  sensitive: {
    pillClass: "bg-[#FFEDD5] text-[#9A3412] border-[#FDBA74]",
    barClass: "bg-[#EA580C]",
    dotClass: "bg-[#9A3412]",
    strokeColor: "#C2410C",
    shortTag: "SENSITIVE ALERT",
  },
  unhealthy: {
    pillClass: "bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]",
    barClass: "bg-[#DC2626]",
    dotClass: "bg-[#991B1B]",
    strokeColor: "#B91C1C",
    shortTag: "UNHEALTHY",
  },
  very_unhealthy: {
    pillClass: "bg-[#F3E8FF] text-[#581C87] border-[#D8B4FE]",
    barClass: "bg-[#7E22CE]",
    dotClass: "bg-[#581C87]",
    strokeColor: "#6B21A8",
    shortTag: "VERY UNHEALTHY",
  },
  hazardous: {
    pillClass: "bg-[#FECACA] text-[#7F1D1D] border-[#991B1B]",
    barClass: "bg-[#991B1B]",
    dotClass: "bg-[#7F1D1D]",
    strokeColor: "#7F1D1D",
    shortTag: "HAZARDOUS SMOG",
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
