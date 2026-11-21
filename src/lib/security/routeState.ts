import type { ActionPlanResponse } from "../schemas";
import { TtlCache } from "./cache";
import { SlidingWindowRateLimiter } from "./rateLimit";

export const aqRateLimiter = new SlidingWindowRateLimiter(60, 60_000);
export const planRateLimiter = new SlidingWindowRateLimiter(15, 60_000);
export const chatRateLimiter = new SlidingWindowRateLimiter(20, 60_000);
export const planCache = new TtlCache<ActionPlanResponse>(150);

export function resetAllRouteState(): void {
  aqRateLimiter.clear();
  planRateLimiter.clear();
  chatRateLimiter.clear();
  planCache.clear();
}
