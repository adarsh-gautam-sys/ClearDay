export interface EmergencyCheckResult {
  isEmergency: boolean;
  alertMessage: string;
}

const EMERGENCY_PATTERNS: readonly RegExp[] = [
  /\bcan(?:'|no)?t\s+breathe\b/i,
  /\bdifficulty\s+breathing\b/i,
  /\bshortness\s+of\s+breath\b/i,
  /\bchest\s+(?:pain|tightness|pressure)\b/i,
  /\bblue\s+lips\b/i,
  /\bsevere\s+asthma\b/i,
  /\binhaler\s+(?:not|isn['’]?t)\s+working\b/i,
  /\bgasping\b/i,
  /\bfainting\b/i,
  /\bwheezing\s+badly\b/i,
];

/**
 * Strips ASCII control characters (preserving newlines) and normalizes length
 * before any prompt assembly.
 */
export function sanitizeUserText(input: string, maxLength: number): string {
  const cleaned = input
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return cleaned.slice(0, maxLength);
}

/**
 * Strips angle brackets in addition to control characters so untrusted user or
 * third-party strings cannot break out of XML prompt boundary tags.
 */
export function escapePromptDelimiters(input: string, maxLength: number): string {
  return sanitizeUserText(input, maxLength).replace(/[<>]/g, "");
}

/**
 * Deterministic pre-generation medical safety guardrail for acute respiratory
 * distress signals.
 */
export function detectRespiratoryEmergency(text: string): EmergencyCheckResult {
  const normalized = sanitizeUserText(text, 1000);
  const triggered = EMERGENCY_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );

  if (!triggered) {
    return { isEmergency: false, alertMessage: "" };
  }

  return {
    isEmergency: true,
    alertMessage:
      "Possible respiratory emergency detected. If anyone has severe trouble breathing, chest pain, blue lips, or an asthma attack not relieved by rescue medication, seek emergency medical care immediately.",
  };
}
