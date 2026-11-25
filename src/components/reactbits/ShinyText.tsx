"use client";

import { cn } from "@/lib/utils";

interface ShinyTextProps {
  text: string;
  className?: string;
}

/**
 * Subtle metallic sweep badge text inspired by ReactBits ShinyText.
 */
export function ShinyText({ text, className }: ShinyTextProps) {
  return (
    <span className={cn("shiny-text inline-block", className)}>{text}</span>
  );
}
