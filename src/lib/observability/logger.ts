export type LogSeverity = "INFO" | "WARNING" | "ERROR";

interface LogEntry {
  severity: LogSeverity;
  component: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function emitLog(
  severity: LogSeverity,
  component: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const entry: LogEntry = {
    severity,
    component,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  const serialized = JSON.stringify(entry);

  if (severity === "ERROR") {
    console.error(serialized);
  } else if (severity === "WARNING") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}

export function logInfo(
  component: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  emitLog("INFO", component, message, meta);
}

export function logWarn(
  component: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  emitLog("WARNING", component, message, meta);
}

export function logError(
  component: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  emitLog("ERROR", component, message, meta);
}

/**
 * Throttles repetitive infrastructure warnings to at most once per cooldown
 * interval while emitting Cloud Logging compatible JSON payloads.
 */
export function createRateLimitedLogger(
  component: string,
  cooldownMs = 60_000,
): (op: string, detail: string) => void {
  let lastWarnAt = 0;
  return (op: string, detail: string) => {
    const now = Date.now();
    if (now - lastWarnAt < cooldownMs) return;
    lastWarnAt = now;
    logWarn(component, `${op} failed`, { op, detail });
  };
}
