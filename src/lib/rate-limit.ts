import { db, nowIso } from "@/lib/db";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Fixed-window rate limiter persisted in the database so it works across
 * serverless instances. Keys are hashed by the caller (never raw emails in prod).
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();

  const result = await db.transaction().execute(async (tx) => {
    const row = await tx.selectFrom("rate_limits").selectAll().where("key", "=", key).executeTakeFirst();
    if (!row || row.window_start !== windowStart) {
      if (row) {
        await tx
          .updateTable("rate_limits")
          .set({ window_start: windowStart, count: 1 })
          .where("key", "=", key)
          .execute();
      } else {
        await tx.insertInto("rate_limits").values({ key, window_start: windowStart, count: 1 }).execute();
      }
      return { count: 1, reset: false };
    }
    if (row.count >= limit) {
      return { count: row.count, reset: true };
    }
    const next = row.count + 1;
    await tx.updateTable("rate_limits").set({ count: next }).where("key", "=", key).execute();
    return { count: next, reset: false };
  });

  const windowEnd = new Date(new Date(windowStart).getTime() + windowSeconds * 1000).getTime();
  return {
    ok: !result.reset,
    remaining: Math.max(0, limit - result.count),
    retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now) / 1000)),
  };
}

export async function purgeRateLimits(): Promise<void> {
  const cutoff = new Date(Date.now() - 2 * 86_400_000).toISOString();
  await db.deleteFrom("rate_limits").where("window_start", "<", cutoff).execute();
}

export async function recordRateLimitHit(key: string, windowSeconds: number): Promise<void> {
  await rateLimit(key, Number.MAX_SAFE_INTEGER, windowSeconds);
  void nowIso;
}
