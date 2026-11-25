import { createHash } from "node:crypto";
import {
  type DistributedStore,
  MAX_CACHE_ENTRY_BYTES,
  type WindowCheckResult,
} from "./types";

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

  constructor(options: FirestoreRestOptions) {
    this.projectId = options.projectId;
    this.collection = options.collection ?? "clearday_cache";
    this.timeoutMs = options.timeoutMs ?? 1500;
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
      if (!res.ok) return null;

      const doc = (await res.json()) as FirestoreDocument;
      const expireAtIso = doc.fields?.expireAt?.timestampValue;
      if (expireAtIso && Date.parse(expireAtIso) <= Date.now()) {
        return null;
      }

      const payload = doc.fields?.payload?.stringValue;
      if (!payload) return null;
      return JSON.parse(payload) as T;
    } catch {
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSec: number): Promise<void> {
    if (ttlSec <= 0) return;
    const serialized = JSON.stringify(value);
    const bytes = new TextEncoder().encode(serialized).byteLength;
    if (bytes > MAX_CACHE_ENTRY_BYTES) return;

    const token = await this.getAccessToken();
    if (!token) return;

    const docId = this.hashId("kv", key);
    const expireAt = new Date(Date.now() + ttlSec * 1000).toISOString();
    const url = `${this.documentsRoot()}/${this.collection}/${docId}`;

    try {
      await fetch(url, {
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
    } catch {
      // Fail open: cache write failure never blocks serving the response.
    }
  }

  async incrementWindow(
    key: string,
    windowSec: number,
    now = Date.now(),
  ): Promise<WindowCheckResult> {
    const windowMs = Math.max(1000, windowSec * 1000);
    const bucketId = Math.floor(now / windowMs);
    const expiresAtMs = (bucketId + 1) * windowMs;
    const retryAfterSec = Math.max(1, Math.ceil((expiresAtMs - now) / 1000));

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
    } catch {
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
      if (!res.ok) return null;

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
    } catch {
      return null;
    }
  }
}
