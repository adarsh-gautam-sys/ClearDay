import { createRateLimitedLogger } from "../observability/logger";

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

/**
 * Acquires short-lived OAuth tokens from the Google Cloud Run metadata server
 * for keyless Firestore REST calls, with local TTL caching and test-token override.
 */
export class GcpMetadataTokenProvider {
  private cachedToken: CachedToken | null = null;
  private readonly logWarn = createRateLimitedLogger("GcpMetadata");

  async getAccessToken(): Promise<string | null> {
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
        this.logWarn("metadataToken", `HTTP ${res.status}`);
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
      this.logWarn("metadataToken", reason);
      return null;
    }
  }
}
