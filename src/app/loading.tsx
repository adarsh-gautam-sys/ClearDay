export default function LoadingWorkspace() {
  return (
    <main
      id="main-content"
      role="status"
      aria-live="polite"
      aria-label="Loading live urban air quality telemetry"
      className="min-h-screen bg-[#141517] p-4 sm:p-6"
    >
      <div className="mx-auto max-w-[1440px] rounded-2xl border border-[#D8D2C5] bg-[#F6F4EF] p-6 shadow-beautiful-lg">
        <p className="font-mono text-xs font-medium text-[#0F6E6E]">
          Loading ClearDay telemetry and winter smog action plan…
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.32fr_0.95fr]">
          <div className="h-72 animate-pulse rounded-xl border border-[#D8D2C5] bg-[#FCFBF8]" />
          <div className="h-72 animate-pulse rounded-xl border border-[#D8D2C5] bg-[#FCFBF8]" />
        </div>
      </div>
    </main>
  );
}
