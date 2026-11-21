import { describe, expect, it } from "vitest";
import { TtlCache } from "@/lib/security/cache";
import { SlidingWindowRateLimiter } from "@/lib/security/rateLimit";

describe("TtlCache", () => {
  it("expires items after TTL and evicts oldest at capacity", () => {
    const cache = new TtlCache<string>(2);
    cache.set("a", "1", 1000, 100);
    cache.set("b", "2", 1000, 100);

    expect(cache.get("a", 500)).toBe("1");
    expect(cache.get("a", 1200)).toBeUndefined();

    cache.set("c", "3", 1000, 1200);
    cache.set("d", "4", 1000, 1200);
    cache.set("e", "5", 1000, 1200);
    expect(cache.size()).toBe(2);
    expect(cache.get("c", 1250)).toBeUndefined();
    expect(cache.get("e", 1250)).toBe("5");
  });
});

describe("SlidingWindowRateLimiter", () => {
  it("blocks requests over limit and recovers after window elapses", () => {
    const limiter = new SlidingWindowRateLimiter(3, 10_000);

    expect(limiter.check("ip1:/api/plan", 1000).allowed).toBe(true);
    expect(limiter.check("ip1:/api/plan", 2000).allowed).toBe(true);
    expect(limiter.check("ip1:/api/plan", 3000).allowed).toBe(true);

    const blocked = limiter.check("ip1:/api/plan", 4000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);

    // Other IP remains allowed
    expect(limiter.check("ip2:/api/plan", 4000).allowed).toBe(true);

    // Original IP recovers once window slides past first hit
    expect(limiter.check("ip1:/api/plan", 12_000).allowed).toBe(true);
  });
});
