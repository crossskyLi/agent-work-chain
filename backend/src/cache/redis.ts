import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;
let connecting: Promise<ReturnType<typeof createClient> | null> | null = null;
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

function getRedisUrl(): string | undefined {
  return process.env.REDIS_URL;
}

export function isRedisEnabled(): boolean {
  return Boolean(getRedisUrl());
}

export async function getRedisClient(): Promise<ReturnType<typeof createClient> | null> {
  const url = getRedisUrl();
  if (!url) return null;

  if (redisClient && redisClient.isOpen) return redisClient;
  if (connecting) return connecting;

  connecting = (async () => {
    const client = createClient({ url });
    client.on('error', (err) => {
      // Keep service alive if redis blips.
      console.warn('[redis] client error:', err.message);
    });
    await client.connect();
    redisClient = client;
    connecting = null;
    return client;
  })();

  return connecting;
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  let raw: string | null = null;
  if (!client) {
    const item = memoryCache.get(key);
    if (item && item.expiresAt > Date.now()) {
      raw = item.value;
    } else if (item) {
      memoryCache.delete(key);
    }
  } else {
    raw = await client.get(key);
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    memoryCache.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return;
  }
  await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
}

export async function cacheDel(key: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) {
    memoryCache.delete(key);
    return;
  }
  await client.del(key);
}

export async function closeRedis(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
  }
  redisClient = null;
  connecting = null;
  memoryCache.clear();
}
