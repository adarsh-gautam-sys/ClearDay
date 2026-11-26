"use client";

import { useEffect, useRef, useState } from "react";
import { parseSseBuffer } from "@/lib/ai/sse";
import type {
  AirQualitySnapshot,
  ChatMessage,
  HouseholdProfile,
} from "@/lib/schemas";
import type { AgentPhase } from "./AgentStatus";

interface UseSmogCopilotOptions {
  airQuality: AirQualitySnapshot;
  profile: HouseholdProfile;
  adoptedTitles: string[];
}

/**
 * Manages SSE streaming state, abort cancellation, and respiratory alert
 * flagging for the SmogCopilot presentation component.
 */
export function useSmogCopilot({
  airQuality,
  profile,
  adoptedTitles,
}: UseSmogCopilotOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [medicalAlert, setMedicalAlert] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    setErrorMsg(null);
    setPhase("idle");
  }, [airQuality.location.name]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function handleStop() {
    abortRef.current?.abort();
    setPhase("done");
  }

  async function submitQuestion(questionText: string) {
    const clean = questionText.trim();
    if (!clean || phase === "writing" || phase === "reasoning") return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setErrorMsg(null);
    const nextHistory = [...messages, { role: "user" as const, content: clean }];
    setMessages([...nextHistory, { role: "assistant", content: "" }]);
    setInput("");
    setPhase("reasoning");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          airQuality,
          profile,
          adoptedTitles,
          history: messages.slice(-6),
          message: clean,
        }),
        signal: controller.signal,
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
      let sseBuffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseBuffer(sseBuffer);
        sseBuffer = rest;

        for (const evt of events) {
          if (evt.event === "meta" && evt.data.medicalAlert) {
            setMedicalAlert(true);
          } else if (evt.event === "chunk") {
            accumulated += evt.data.text;
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx]?.role === "assistant") {
                updated[lastIdx] = { role: "assistant", content: accumulated };
              }
              return updated;
            });
          } else if (evt.event === "error") {
            setErrorMsg(evt.data.message);
          }
        }
      }

      setPhase("done");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setPhase("done");
        return;
      }
      setPhase("error");
      setErrorMsg("Unable to reach Smog Copilot right now. Please try again.");
      setMessages((prev) => prev.slice(0, -1));
    }
  }

  return {
    messages,
    input,
    setInput,
    phase,
    medicalAlert,
    errorMsg,
    isBusy: phase === "reasoning" || phase === "writing",
    handleStop,
    submitQuestion,
  };
}
