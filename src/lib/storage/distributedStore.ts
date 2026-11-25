import { FirestoreRestStore } from "./firestoreStore";
import { ByteBoundedMemoryStore } from "./memoryStore";
import { RedisRestStore } from "./redisRestStore";
import type { DistributedStore } from "./types";

let activeStore: DistributedStore | null = null;
let overrideStore: DistributedStore | null = null;

function createStoreFromEnv(): DistributedStore {
  const redisUrl =
    process.env.REDIS_REST_URL?.trim() ||
    process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken =
    process.env.REDIS_REST_TOKEN?.trim() ||
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (redisUrl && redisToken) {
    return new RedisRestStore({ url: redisUrl, token: redisToken });
  }

  const firestoreEnabled =
    process.env.FIRESTORE_CACHE_ENABLED?.trim() === "true";
  const projectId =
    process.env.FIRESTORE_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim();

  if (firestoreEnabled && projectId) {
    return new FirestoreRestStore({
      projectId,
      collection: process.env.FIRESTORE_COLLECTION?.trim() || "clearday_cache",
    });
  }

  return new ByteBoundedMemoryStore();
}

export function getDistributedStore(): DistributedStore {
  if (overrideStore) return overrideStore;
  if (!activeStore) {
    activeStore = createStoreFromEnv();
  }
  return activeStore;
}

export function setDistributedStoreForTests(
  store: DistributedStore | null,
): void {
  overrideStore = store;
}

export async function resetDistributedStore(): Promise<void> {
  if (overrideStore?.clear) {
    await overrideStore.clear();
  }
  if (activeStore?.clear) {
    await activeStore.clear();
  }
  activeStore = null;
}
