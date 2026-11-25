"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-[#141517] p-6"
    >
      <div
        role="alert"
        className="w-full max-w-md rounded-xl border border-[#D8D2C5] bg-[#FCFBF8] p-6 shadow-beautiful-md"
      >
        <div className="flex items-center gap-2 text-[#991B1B]">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          <h1 className="text-base font-bold">
            Unable to load ClearDay workspace
          </h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[#3F3F46]">
          A temporary telemetry or rendering error occurred. Reload the workspace to fetch fresh winter smog guidance.
        </p>
        <Button onClick={reset} className="mt-4">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Try Again</span>
        </Button>
      </div>
    </main>
  );
}
