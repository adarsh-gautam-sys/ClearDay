"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  to: number;
  decimals?: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * Smooth ease-out animated number readout inspired by ReactBits CountUp,
 * respecting prefers-reduced-motion and tabular-nums alignment.
 */
export function CountUp({
  to,
  decimals = 0,
  durationMs = 520,
  prefix = "",
  suffix = "",
  className,
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(to);
  const previousRef = useRef(to);

  useEffect(() => {
    const startValue = previousRef.current;
    previousRef.current = to;

    if (
      startValue === to ||
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplayValue(to);
      return;
    }

    let frameId = 0;
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startValue + (to - startValue) * eased;
      setDisplayValue(next);
      if (t < 1) {
        frameId = window.requestAnimationFrame(step);
      } else {
        setDisplayValue(to);
      }
    }

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [to, durationMs]);

  const formatted = displayValue.toFixed(decimals);
  const finalFormatted = to.toFixed(decimals);

  return (
    <span className={className}>
      <span className="sr-only">
        {prefix}
        {finalFormatted}
        {suffix}
      </span>
      <span aria-hidden="true">
        {prefix}
        {formatted}
        {suffix}
      </span>
    </span>
  );
}
