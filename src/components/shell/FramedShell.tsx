import type { ReactNode } from "react";

interface FramedShellProps {
  children: ReactNode;
}

/**
 * Master paper-technical container inspired by MengTo/Skills:
 * dark outer charcoal field framing a warm, tactile paper workspace with L-brackets.
 */
export function FramedShell({ children }: FramedShellProps) {
  return (
    <div className="min-h-screen bg-[#141517] px-2 py-2 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="relative mx-auto max-w-[1440px] overflow-hidden rounded-2xl border border-[#2C2E33] shadow-beautiful-lg sm:rounded-[22px]">
        <div className="paper-diagonal-surface relative min-h-[calc(100vh-2.5rem)] rounded-2xl border border-[#D8D2C5]/80 sm:rounded-[22px]">
          {/* Subtle technical corner L-brackets */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-2.5 h-3 w-3 border-l border-t border-[#9E9788]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-2.5 h-3 w-3 border-r border-t border-[#9E9788]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2.5 left-2.5 h-3 w-3 border-b border-l border-[#9E9788]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2.5 right-2.5 h-3 w-3 border-b border-r border-[#9E9788]"
          />
          {children}
        </div>
      </div>
    </div>
  );
}
