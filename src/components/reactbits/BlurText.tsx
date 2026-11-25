"use client";

import { cn } from "@/lib/utils";

interface BlurTextProps {
  text: string;
  animateKey: string;
  className?: string;
}

/**
 * Crisp 220ms optical settle reveal on location transitions while keeping
 * full accessible text intact for screen readers.
 */
export function BlurText({ text, animateKey, className }: BlurTextProps) {
  return (
    <span key={animateKey} className={cn("blur-settle inline-block", className)}>
      {text}
    </span>
  );
}
