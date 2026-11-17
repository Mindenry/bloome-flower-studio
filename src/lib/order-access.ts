import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE = "bloome_order_access";
const MAX_ORDERS = 12;

function sign(orderId: string): string {
  return createHmac("sha256", env.authSecret).update(`order:${orderId}`).digest("hex").slice(0, 32);
}

export async function grantOrderAccess(orderId: string): Promise<void> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value ?? "";
  const entries = existing.split(".").filter(Boolean);
  const entry = `${orderId}:${sign(orderId)}`;
  const next = [entry, ...entries.filter((item) => !item.startsWith(`${orderId}:`))].slice(0, MAX_ORDERS).join(".");
  jar.set(COOKIE, next, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86_400,
  });
}

export async function hasOrderAccess(orderId: string): Promise<boolean> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value ?? "";
  const expected = sign(orderId);
  const entry = existing.split(".").find((item) => item.startsWith(`${orderId}:`));
  if (!entry) return false;
  const provided = entry.slice(orderId.length + 1);
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
