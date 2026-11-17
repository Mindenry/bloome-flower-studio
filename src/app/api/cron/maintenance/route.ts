import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { expireStaleOrders } from "@/lib/checkout";
import { purgeExpiredSessions } from "@/lib/auth/session";
import { purgeRateLimits } from "@/lib/rate-limit";
import { db, nowIso } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  if (!env.cronSecret) return false;
  const provided = request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("key") ?? "";
  const left = Buffer.from(provided);
  const right = Buffer.from(env.cronSecret);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Maintenance endpoint — call every 5 minutes from a scheduler (cron, Vercel Cron,
 * GitHub Actions). Handles payment expiry, abandoned carts and housekeeping.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const expiredOrders = await expireStaleOrders();
  await purgeExpiredSessions();
  await purgeRateLimits();

  const cutoff = new Date(Date.now() - 4 * 3_600_000).toISOString();
  const abandoned = await db
    .selectFrom("carts")
    .select("id")
    .where("status", "=", "active")
    .where("updated_at", "<", cutoff)
    .where("abandoned_notified_at", "is", null)
    .limit(50)
    .execute();

  for (const cart of abandoned) {
    const items = await db
      .selectFrom("cart_items")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("cart_id", "=", cart.id)
      .executeTakeFirst();
    if (Number(items?.count ?? 0) === 0) {
      await db.deleteFrom("carts").where("id", "=", cart.id).execute();
      continue;
    }
    await db
      .updateTable("carts")
      .set({ abandoned_notified_at: nowIso() })
      .where("id", "=", cart.id)
      .execute();
    // Notification dispatch is consent-gated at the marketing layer; marking the
    // cart is what enables that audience in the admin report.
  }

  return NextResponse.json({ ok: true, expiredOrders, abandonedCarts: abandoned.length });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
