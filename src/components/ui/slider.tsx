"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface SliderProps {
  id?: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onValueChange: (val: number) => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaValueText?: string;
  className?: string;
}

export function Slider({
  id,
  min,
  max,
  step = 1,
  value,
  onValueChange,
  ariaLabel,
  ariaLabelledBy,
  ariaValueText,
  className,
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      id={id}
      min={min}
      max={max}
      step={step}
      value={[value]}
      onValueChange={(vals) => {
        const next = vals[0];
        if (typeof next === "number") onValueChange(next);
      }}
      className={cn(
        "relative flex w-full touch-none select-none items-center py-2",
        className,
      )}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-[#D8D2C5]">
        <SliderPrimitive.Range className="absolute h-full bg-[#0F6E6E]" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-valuetext={ariaValueText}
        className="block h-4 w-4 cursor-grab rounded-full border-2 border-[#0F6E6E] bg-[#FCFBF8] shadow-beautiful-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6E6E] focus-visible:ring-offset-2 active:cursor-grabbing"
      />
    </SliderPrimitive.Root>
  );
}
