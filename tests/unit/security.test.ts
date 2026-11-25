import { afterEach, describe, expect, it, vi } from "vitest";
import { readBoundedJson } from "@/lib/security/http";
import { checkRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { FirestoreRestStore } from "@/lib/storage/firestoreStore";
import { ByteBoundedMemoryStore } from "@/lib/storage/memoryStore";
import { RedisRestStore } from "@/lib/storage/redisRestStore";

describe("ByteBoundedMemoryStore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("evicts expired and oldest LRU entries while enforcing byte ceiling", async () => {
    const store = new ByteBoundedMemoryStore(10, 90);
    await store.setJson("a", { txt: "12345678901234567890" }, 60, 100);
    await store.setJson("b", { txt: "12345678901234567890" }, 60, 100);
    // Refresh "a" so "b" becomes least recently used
    expect(await store.getJson("a", 200)).toEqual({
      txt: "12345678901234567890",
    });

    await store.setJson(
      "c",
      { txt: "1234567890123456789012345678901234567890" },
      60,
      300,
    );

    expect(store.currentByteSize()).toBeLessThanOrEqual(90);
    expect(await store.getJson("b", 350)).toBeNull();
    expect(await store.getJson("c", 350)).not.toBeNull();
  });

  it("refuses to cache single entries exceeding 64 KiB", async () => {
    const store = new ByteBoundedMemoryStore(10, 500_000);
    await store.setJson("huge", { data: "x".repeat(70_000) }, 60);
    expect(store.entryCount()).toBe(0);
    expect(store.currentByteSize()).toBe(0);
  });
});

describe("RedisRestStore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads/writes JSON via pipeline and fails open when network errors", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: "OK" }]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: JSON.stringify({ ok: 42 }) }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 4 }, { result: 1 }]), {
          status: 200,
        }),
      );

    const store = new RedisRestStore({
      url: "https://redis.example.test",
      token: "secret",
    });

    await store.setJson("k1", { ok: 42 }, 60);
    expect(await store.getJson<{ ok: number }>("k1")).toEqual({ ok: 42 });

    const limit = await checkRateLimit("ip:/api/plan", 3, 60, store);
    expect(limit.allowed).toBe(false);

    fetchSpy.mockRejectedValueOnce(new Error("timeout"));
    const failOpen = await checkRateLimit("ip:/api/plan", 3, 60, store);
    expect(failOpen.allowed).toBe(true);
  });
});

describe("FirestoreRestStore", () => {
  afterEach(() => {
    delete process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
    vi.restoreAllMocks();
  });

  it("increments distributed window counters via Firestore REST commit and reads cached docs", async () => {
    process.env.GOOGLE_OAUTH_ACCESS_TOKEN = "test-token";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            fields: {
              payload: { stringValue: JSON.stringify({ city: "Milan" }) },
              expireAt: {
                timestampValue: new Date(Date.now() + 60_000).toISOString(),
              },
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            writeResults: [{ transformResults: [{ integerValue: "5" }] }],
          }),
          { status: 200 },
        ),
      );

    const store = new FirestoreRestStore({ projectId: "test-proj" });
    expect(await store.getJson<{ city: string }>("aq:milan")).toEqual({
      city: "Milan",
    });

    const rl = await store.incrementWindow("ip:/api/chat", 60);
    expect(rl.count).toBe(5);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("HTTP & proxy security helpers", () => {
  it("extracts rightmost valid IP from X-Forwarded-For to prevent spoofing", () => {
    const req = new Request("http://localhost/api/plan", {
      headers: {
        "x-forwarded-for": "1.2.3.4, bad-value, 203.0.113.99",
      },
    });
    expect(getClientIp(req)).toBe("203.0.113.99");
  });

  it("rejects payloads exceeding byte ceiling with 413", async () => {
    const oversized = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "a".repeat(2000) }),
    });
    const res = await readBoundedJson(oversized, 512);
    expect(res).toEqual({
      ok: false,
      status: 413,
      error: "Request payload too large.",
    });
  });
});
