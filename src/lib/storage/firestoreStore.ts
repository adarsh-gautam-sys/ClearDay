import { createHash } from "node:crypto";
import {
  type DistributedStore,
  MAX_CACHE_ENTRY_BYTES,
  type WindowCheckResult,
} from "./types";
import {
  computeFixedWindow,
  createRateLimitedWarner,
  utf8ByteLength,
} from "./utils";

interface FirestoreRestOptions {
  projectId: string;
  collection?: string;
  timeoutMs?: number;
}

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

interface FirestoreDocument {
  fields?: {
    payload?: { stringValue?: string };
    expireAt?: { timestampValue?: string };
  };
}

interface FirestoreCommitResponse {
  writeResults?: Array<{
    transformResults?: Array<{
      integerValue?: string;
    }>;
  }>;
}

/**
 * Native Google Cloud Firestore REST store for Cloud Run.
 * Uses the Cloud Run metadata server service-account token with zero heavy SDK deps.
 */
export class FirestoreRestStore implements DistributedStore {
  readonly backend = "firestore" as const;
  private readonly projectId: string;
  private readonly collection: string;
  private readonly timeoutMs: number;
  private cachedToken: CachedToken | null = null;
  private readonly warn = createRateLimitedWarner("FirestoreRestStore");

  constructor(options: FirestoreRestOptions) {
    this.projectId = options.projectId;
    this.collection = options.collection ?? "clearday_cache";
    this.timeoutMs = options.timeoutMs ?? 1500;
  }

  async ping(): Promise<boolean> {
    const token = await this.getAccessToken();
    if (!token) {
      this.warn("ping", "unable to acquire metadata OAuth token");
      return false;
    }

    const docId = this.hashId("kv", "probe:health");
    const url = `${this.documentsRoot()}/${this.collection}/${docId}`;
    const expireAt = new Date(Date.now() + 60_000).toISOString();

    try {
      const writeRes = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            payload: { stringValue: JSON.stringify({ ok: true }) },
            expireAt: { timestampValue: expireAt },
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!writeRes.ok) {
        this.warn("ping:write", `HTTP ${writeRes.status}`);
        return false;
      }

      const readRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!readRes.ok) {
        this.warn("ping:read", `HTTP ${readRes.status}`);
        return false;
      }

      const doc = (await readRes.json()) as FirestoreDocument;
      const payload = doc.fields?.payload?.stringValue;
      if (!payload) return false;
      const parsed = JSON.parse(payload) as { ok?: unknown };
      return parsed.ok === true;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network_error";
      this.warn("ping", reason);
      return false;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    const docId = this.hashId("kv", key);
    const url = `${this.documentsRoot()}/${this.collection}/${docId}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        this.warn("getJson", `HTTP ${res.status}`);
        return null;
      }

      const doc = (await res.json()) as FirestoreDocument;
      const expireAtIso = doc.fields?.expireAt?.timestampValue;
      if (expireAtIso && Date.parse(expireAtIso) <= Date.now()) {
        return null;
      }

      const payload = doc.fields?.payload?.stringValue;
      if (!payload) return null;
      return JSON.parse(payload) as T;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network_error";
      this.warn("getJson", reason);
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSec: number): Promise<void> {
    if (ttlSec <= 0) return;
    const serialized = JSON.stringify(value);
    if (utf8ByteLength(serialized) > MAX_CACHE_ENTRY_BYTES) return;

    const token = await this.getAccessToken();
    if (!token) return;

    const docId = this.hashId("kv", key);
    const expireAt = new Date(Date.now() + ttlSec * 1000).toISOString();
    const url = `${this.documentsRoot()}/${this.collection}/${docId}`;

    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            payload: { stringValue: serialized },
            expireAt: { timestampValue: expireAt },
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        this.warn("setJson", `HTTP ${res.status}`);
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network_error";
      this.warn("setJson", reason);
    }
  }

  async incrementWindow(
    key: string,
    windowSec: number,
    now = Date.now(),
  ): Promise<WindowCheckResult> {
    const { bucketId, expiresAtMs, retryAfterSec } = computeFixedWindow(
      windowSec,
      now,
    );

    const token = await this.getAccessToken();
    if (!token) {
      return { count: 1, retryAfterSec };
    }

    const docId = this.hashId("rl", `${key}:${bucketId}`);
    const docName = `projects/${this.projectId}/databases/(default)/documents/${this.collection}/${docId}`;
    const commitUrl = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents:commit`;

    try {
      const res = await fetch(commitUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          writes: [
            {
              update: {
                name: docName,
                fields: {
                  expireAt: {
                    timestampValue: new Date(expiresAtMs).toISOString(),
                  },
                },
              },
              updateMask: { fieldPaths: ["expireAt"] },
              updateTransforms: [
                {
                  fieldPath: "count",
                  increment: { integerValue: "1" },
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        this.warn("incrementWindow", `HTTP ${res.status}`);
        return { count: 1, retryAfterSec };
      }

      const body = (await res.json()) as FirestoreCommitResponse;
      const rawInt =
        body.writeResults?.[0]?.transformResults?.[0]?.integerValue;
      const count = rawInt ? Number(rawInt) : 1;

      return {
        count: Number.isFinite(count) && count > 0 ? count : 1,
        retryAfterSec,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network_error";
      this.warn("incrementWindow", reason);
      return { count: 1, retryAfterSec };
    }
  }

  private documentsRoot(): string {
    return `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
  }

  private hashId(prefix: string, key: string): string {
    const hex = createHash("sha256").update(key).digest("hex").slice(0, 40);
    return `${prefix}_${hex}`;
  }

  private async getAccessToken(): Promise<string | null> {
    const envToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN?.trim();
    if (envToken) return envToken;

    if (this.cachedToken && Date.now() < this.cachedToken.expiresAtMs) {
      return this.cachedToken.accessToken;
    }

    try {
      const res = await fetch(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
        {
          headers: { "Metadata-Flavor": "Google" },
          signal: AbortSignal.timeout(1000),
        },
      );
      if (!res.ok) {
        this.warn("metadataToken", `HTTP ${res.status}`);
        return null;
      }

      const data = (await res.json()) as {
        access_token?: string;
        expires_in?: number;
      };
      if (!data.access_token) return null;

      const ttlMs = Math.max(60_000, ((data.expires_in ?? 300) - 60) * 1000);
      this.cachedToken = {
        accessToken: data.access_token,
        expiresAtMs: Date.now() + ttlMs,
      };
      return data.access_token;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network_error";
      this.warn("metadataToken", reason);
      return null;
    }
  }
}
