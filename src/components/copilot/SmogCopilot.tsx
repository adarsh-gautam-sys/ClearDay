"use client";

import { useState, type FormEvent } from "react";
import { AlertTriangle, Send } from "lucide-react";
import type {
  AirQualitySnapshot,
  ChatMessage,
  HouseholdProfile,
} from "@/lib/schemas";
import { AgentStatus, type AgentPhase } from "./AgentStatus";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [medicalAlert, setMedicalAlert] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submitQuestion(questionText: string) {
    const clean = questionText.trim();
    if (!clean || phase === "writing" || phase === "reasoning") return;

    setErrorMsg(null);
    const nextHistory = [...messages, { role: "user" as const, content: clean }];
    setMessages([...nextHistory, { role: "assistant", content: "" }]);
    setInput("");
    setPhase("reasoning");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          airQuality,
          profile,
          adoptedTitles,
          history: messages.slice(-6),
          message: clean,
        }),
      });

      if (response.headers.get("X-Medical-Alert") === "true") {
        setMedicalAlert(true);
      }

      if (!response.ok || !response.body) {
        throw new Error(`Request failed (${response.status})`);
      }

      setPhase("writing");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx]?.role === "assistant") {
            updated[lastIdx] = { role: "assistant", content: accumulated };
          }
          return updated;
        });
      }

      setPhase("done");
    } catch {
      setPhase("error");
      setErrorMsg("Unable to reach Smog Copilot right now. Please try again.");
      setMessages((prev) => prev.slice(0, -1));
    }
  }

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
          <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-[#52525B]">
            05 · GROUNDED SMOG COPILOT
          </span>
          <h2
            id="smog-copilot-heading"
            className="mt-0.5 text-base font-bold text-[#18181B]"
          >
            Ask About Today&apos;s Air in {airQuality.location.name}
          </h2>
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
          <button
            key={chip}
            type="button"
            disabled={phase === "reasoning" || phase === "writing"}
            onClick={() => void submitQuestion(chip)}
            className="rounded-md border border-[#D8D2C5] bg-[#F6F4EF] px-2.5 py-1 text-left text-xs font-medium text-[#3F3F46] hover:bg-[#ECE8DF] hover:text-[#18181B] disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Message Feed */}
      <div className="relative mt-3 max-h-72 min-h-[140px] space-y-2.5 overflow-y-auto rounded-lg border border-[#E5E0D5] bg-[#F6F4EF] p-3">
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
              <div className="whitespace-pre-line">
                {msg.content || "…"}
              </div>
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
          className="min-w-0 flex-1 rounded-lg border border-[#D8D2C5] bg-[#F6F4EF] px-3 py-2 text-xs text-[#18181B] placeholder:text-[#71717A] shadow-beautiful-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || phase === "reasoning" || phase === "writing"}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F6E6E] px-3.5 py-2 text-xs font-semibold text-[#FCFBF8] shadow-beautiful-sm hover:bg-[#0D5C5C] disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Ask</span>
        </button>
      </form>

      <p className="mt-2.5 font-mono text-[10px] text-[#52525B]">
        Environmental protection guidance only — not medical diagnosis or
        clinical advice.
      </p>
    </section>
  );
}
