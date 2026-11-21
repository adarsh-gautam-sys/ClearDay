"use client";

import { ThinkingOrb, type OrbState } from "thinking-orbs";

export type AgentPhase =
  | "idle"
  | "retrieving"
  | "reasoning"
  | "writing"
  | "done"
  | "error";

const ORB_BY_PHASE: Partial<Record<AgentPhase, OrbState>> = {
  retrieving: "searching",
  reasoning: "solving",
  writing: "composing",
};

interface AgentStatusProps {
  phase: AgentPhase;
  label: string;
}

/**
 * Accessible AI activity indicator obeying MengTo/Skills thinking-orbs contract:
 * mounts only during active work and pairs an aria-hidden orb with a single live region.
 */
export function AgentStatus({ phase, label }: AgentStatusProps) {
  const orbState = ORB_BY_PHASE[phase];
  if (!orbState) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-lg border border-[#D8D2C5] bg-[#FCFBF8] px-2.5 py-1.5 text-xs font-medium text-[#18181B] shadow-beautiful-sm"
    >
      <ThinkingOrb
        state={orbState}
        size={20}
        theme="light"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
