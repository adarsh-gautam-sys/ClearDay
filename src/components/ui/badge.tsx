import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeStyles = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-[#D8D2C5] bg-[#ECE8DF] text-[#18181B]",
        teal: "border-[#B2DBD4] bg-[#E6F4F1] text-[#0F6E6E]",
        paper: "border-[#E5E0D5] bg-[#F6F4EF] text-[#52525B]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeStyles> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeStyles({ tone }), className)} {...props} />;
}
