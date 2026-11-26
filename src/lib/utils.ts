import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combines Tailwind classes cleanly without cascade collisions. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
