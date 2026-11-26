"use client";

import type { FormEvent } from "react";
import { AlertTriangle, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AirQualitySnapshot, HouseholdProfile } from "@/lib/schemas";
import { AgentStatus } from "./AgentStatus";
import { SafeMessageContent } from "./SafeMessageContent";
import { useSmogCopilot } from "./useSmogCopilot";

interface SmogCopilotProps {
  airQuality: AirQualitySnapshot;
  profile: HouseholdProfile;
  adoptedTitles: string[];
}

const QUICK_PROMPTS = [
  "Can my kids play outside today, and when?",
  "How do I lower indoor smog without a purifier?",
  "Draft a short WhatsApp advisory for our block",
  "Why does smog spike after sunset in winter?",
] as const;

export function SmogCopilot({
  airQuality,
  profile,
  adoptedTitles,
}: SmogCopilotProps) {
  const {
    messages,
    input,
    setInput,
    phase,
    medicalAlert,
    errorMsg,
    isBusy,
    handleStop,
    submitQuestion,
  } = useSmogCopilot({ airQuality, profile, adoptedTitles });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitQuestion(input);
  }

  return (
    <section
      aria-labelledby="smog-copilot-heading"
      className="flex flex-col rounded-xl border border-[#D8D2C5] bg-[#FCFBF8] p-4 shadow-beautiful-md sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E0D5] pb-3">
        <div>
          <h2
            id="smog-copilot-heading"
            className="text-base font-bold text-[#18181B]"
          >
            Smog Copilot · {airQuality.location.name}
          </h2>
          <p className="mt-0.5 text-xs text-[#52525B]">
            Grounded Q&amp;A synced with live telemetry &amp; your adopted plan.
          </p>
        </div>

        <AgentStatus
          phase={phase}
          label={
            phase === "reasoning"
              ? "Reviewing local telemetry…"
              : "Composing tailored guidance…"
          }
        />
      </div>

      {/* Emergency Respiratory Safety Banner */}
      {medicalAlert && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2.5 rounded-lg border-2 border-[#991B1B] bg-[#FEE2E2] p-3 text-xs leading-relaxed text-[#7F1D1D]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <strong>Emergency Medical Notice:</strong> If anyone has chest pain,
            blue lips, severe shortness of breath, or an asthma attack not
            relieved by rescue medication, seek emergency clinical care
            immediately.
          </div>
        </div>
      )}

      {/* Quick Prompts */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((chip) => (
          <Button
            key={chip}
            variant="paper"
            size="sm"
            disabled={isBusy}
            onClick={() => void submitQuestion(chip)}
            className="h-auto whitespace-normal py-1.5 text-left font-medium text-[#3F3F46]"
          >
            {chip}
          </Button>
        ))}
      </div>

      {/* Message Feed */}
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Smog Copilot conversation"
        className="relative mt-3 max-h-72 min-h-[140px] space-y-2.5 overflow-y-auto rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] p-3"
      >
        {messages.length === 0 ? (
          <p className="text-xs leading-relaxed text-[#52525B]">
            Grounded in{" "}
            <strong className="text-[#18181B]">
              {airQuality.location.name}
            </strong>{" "}
            (US AQI {airQuality.current.usAqi}) and your{" "}
            <strong className="text-[#18181B]">{profile.scope}</strong>{" "}
            profile. Pick a prompt above or ask a specific question below.
          </p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={`${msg.role}-${idx}`}
              className={
                msg.role === "user"
                  ? "ml-6 rounded-lg border border-[#0F6E6E]/25 bg-[#E6F4F1] px-3 py-2 text-xs leading-relaxed text-[#18181B]"
                  : "mr-4 rounded-lg border border-[#D8D2C5] bg-[#FCFBF8] px-3 py-2 text-xs leading-relaxed text-[#18181B]"
              }
            >
              <span className="mb-1 block font-mono text-[10px] font-semibold uppercase tracking-wider text-[#52525B]">
                {msg.role === "user" ? "You" : "ClearDay Copilot"}
              </span>
              {msg.role === "user" ? (
                <p className="whitespace-pre-line">{msg.content}</p>
              ) : (
                <SafeMessageContent content={msg.content} />
              )}
            </div>
          ))
        )}
      </div>

      {errorMsg && (
        <p role="alert" className="mt-2 text-xs font-medium text-[#991B1B]">
          {errorMsg}
        </p>
      )}

      {/* Question Form */}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <label htmlFor="copilot-input" className="sr-only">
          Ask ClearDay Smog Copilot
        </label>
        <input
          id="copilot-input"
          type="text"
          maxLength={500}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about school runs, masks, DIY filters, or heating..."
          className="h-8 min-w-0 flex-1 rounded-lg border border-[#D8D2C5] bg-[#F6F4EF] px-3 text-xs text-[#18181B] placeholder:text-[#52525B] shadow-beautiful-sm"
        />
        {isBusy ? (
          <Button type="button" variant="danger" onClick={handleStop}>
            <Square className="h-3 w-3 fill-current" aria-hidden="true" />
            <span>Stop</span>
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()}>
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ask</span>
          </Button>
        )}
      </form>

      <p className="mt-2.5 font-mono text-[10px] text-[#52525B]">
        Environmental protection guidance only — not medical diagnosis or
        clinical advice.
      </p>
    </section>
  );
}
