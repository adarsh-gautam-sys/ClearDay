import { createRateLimitedLogger } from "../observability/logger";
import {
  type DistributedStore,
  MAX_CACHE_ENTRY_BYTES,
  type WindowCheckResult,
} from "./types";
import { computeFixedWindow, utf8ByteLength } from "./utils";

interface RedisRestOptions {
  url: string;
  token: string;
  timeoutMs?: number;
}

interface PipelineItemResult {
  result?: unknown;
  error?: string;
}

/**
 * Stateless Redis HTTP REST store (Upstash / Serverless Redis compatible).
 * Enables shared caching and rate-limiting across horizontally scaled Cloud Run instances.
 */
export class RedisRestStore implements DistributedStore {
  readonly backend = "redis-rest" as const;
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly warn = createRateLimitedLogger("RedisRestStore");

  constructor(options: RedisRestOptions) {
    this.baseUrl = options.url.replace(/\/+$/, "");
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 1500;
  }

  async ping(): Promise<boolean> {
    const items = await this.pipeline([["PING"]]);
    return items?.[0]?.result === "PONG";
  }

  async getJson<T>(key: string): Promise<T | null> {
    const items = await this.pipeline([["GET", key]]);
    const raw = items?.[0]?.result;
    if (typeof raw !== "string" || !raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSec: number): Promise<void> {
    if (ttlSec <= 0) return;
    const serialized = JSON.stringify(value);
    if (utf8ByteLength(serialized) > MAX_CACHE_ENTRY_BYTES) return;

    await this.pipeline([["SET", key, serialized, "EX", String(Math.ceil(ttlSec))]]);
  }

  async incrementWindow(
    key: string,
    windowSec: number,
    now = Date.now(),
  ): Promise<WindowCheckResult> {
    const { bucketId, retryAfterSec } = computeFixedWindow(windowSec, now);
    const bucketKey = `rl:${key}:${bucketId}`;

    const items = await this.pipeline([
      ["INCR", bucketKey],
      ["EXPIRE", bucketKey, String(Math.ceil(windowSec)), "NX"],
    ]);

    const rawCount = items?.[0]?.result;
    const count = typeof rawCount === "number" ? rawCount : Number(rawCount);
    if (!Number.isFinite(count) || count < 1) {
      return { count: 1, retryAfterSec };
    }

    return { count, retryAfterSec };
  }

  private async pipeline(
    commands: string[][],
  ): Promise<PipelineItemResult[] | null> {
    try {
      const res = await fetch(`${this.baseUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commands),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        this.warn("pipeline", `HTTP ${res.status}`);
        return null;
      }
      const json = (await res.json()) as unknown;
      return Array.isArray(json) ? (json as PipelineItemResult[]) : null;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network_error";
      this.warn("pipeline", reason);
      return null;
    }
  }
}
