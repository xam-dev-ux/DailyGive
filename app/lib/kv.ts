import "server-only";
import { Redis } from "@upstash/redis";

// Vercel KV is deprecated; the current Vercel Marketplace path is a direct Upstash Redis
// integration, which auto-populates UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
// Constructed lazily (not at module scope) so importing this file doesn't warn/fail in
// environments — local dev, `next build` — that don't have those env vars set.
let redis: Redis | undefined;
function client(): Redis {
  redis ??= Redis.fromEnv();
  return redis;
}

const LAST_BLOCK_KEY = "dailygive:last_processed_block";

export async function getLastProcessedBlock(): Promise<bigint | null> {
  const value = await client().get<string>(LAST_BLOCK_KEY);
  return value !== null && value !== undefined ? BigInt(value) : null;
}

export async function setLastProcessedBlock(blockNumber: bigint): Promise<void> {
  await client().set(LAST_BLOCK_KEY, blockNumber.toString());
}
