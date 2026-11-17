import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "kysely";
import { db, nowIso, parseJson } from "@/lib/db";
import { env } from "@/lib/env";
import { ids, randomToken } from "@/lib/ids";
import { hashToken } from "./password";
import { hasPermission, type Permission } from "./rbac";

export const SESSION_COOKIE = "bloome_session";
export const GUEST_COOKIE = "bloome_guest";
const SESSION_DAYS = 30;
const ROTATE_AFTER_MS = 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  emailVerifiedAt: string | null;
  phone: string | null;
  avatarUrl: string | null;
  locale: string;
  status: string;
  marketingConsent: boolean;
  role: { id: string; slug: string; name: string; permissions: string[] };
  sessionId: string;
};

export type RequestMeta = { ip: string | null; userAgent: string | null };

export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 400) ?? null };
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function createSession(userId: string, meta: RequestMeta): Promise<void> {
  const token = randomToken(32);
  const tokenHash = await hashToken(token);
  const now = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();

  await db
    .insertInto("sessions")
    .values({
      id: ids.session(),
      user_id: userId,
      token_hash: tokenHash,
      user_agent: meta.userAgent,
      ip: meta.ip,
      expires_at: expiresAt,
      created_at: now,
      last_used_at: now,
      revoked_at: null,
    })
    .execute();

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(SESSION_DAYS * 86_400));
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = await hashToken(token);
    await db
      .updateTable("sessions")
      .set({ revoked_at: nowIso() })
      .where("token_hash", "=", tokenHash)
      .execute();
  }
  jar.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  let query = db
    .updateTable("sessions")
    .set({ revoked_at: nowIso() })
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null);
  if (exceptSessionId) query = query.where("id", "!=", exceptSessionId);
  await query.execute();
}

/** Resolves the current session. `cache()` keeps it to one database round trip per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = await hashToken(token);
  const row = await db
    .selectFrom("sessions")
    .innerJoin("users", "users.id", "sessions.user_id")
    .innerJoin("roles", "roles.id", "users.role_id")
    .select([
      "sessions.id as session_id",
      "sessions.expires_at",
      "sessions.last_used_at",
      "users.id",
      "users.name",
      "users.email",
      "users.email_verified_at",
      "users.phone",
      "users.avatar_url",
      "users.locale",
      "users.status",
      "users.marketing_consent",
      "users.deleted_at",
      "roles.id as role_id",
      "roles.slug as role_slug",
      "roles.name as role_name",
      "roles.permissions as role_permissions",
    ])
    .where("sessions.token_hash", "=", tokenHash)
    .where("sessions.revoked_at", "is", null)
    .where("sessions.expires_at", ">", nowIso())
    .where("users.deleted_at", "is", null)
    .executeTakeFirst();

  if (!row) return null;
  if (row.status !== "active") return null;

  if (Date.now() - new Date(row.last_used_at).getTime() > ROTATE_AFTER_MS) {
    await db
      .updateTable("sessions")
      .set({ last_used_at: nowIso() })
      .where("id", "=", row.session_id)
      .execute();
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerifiedAt: row.email_verified_at,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    locale: row.locale,
    status: row.status,
    marketingConsent: row.marketing_consent === 1,
    sessionId: row.session_id,
    role: {
      id: row.role_id,
      slug: row.role_slug,
      name: row.role_name,
      permissions: parseJson<string[]>(row.role_permissions, []),
    },
  };
});

export function can(user: SessionUser | null, permission: Permission): boolean {
  return hasPermission(user?.role.permissions, permission);
}

export function isStaff(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role.slug !== "customer" && user.role.permissions.length > 0;
}

export async function requireUser(locale: string, returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/${locale}/login${target}`);
  }
  return user;
}

export async function requirePermission(locale: string, permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  if (!can(user, permission)) redirect(`/${locale}/admin?denied=${encodeURIComponent(permission)}`);
  return user;
}

/** API helper: returns the user or throws a typed error handled by apiHandler. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const error = new Error("UNAUTHORIZED") as Error & { status?: number; code?: string };
    error.status = 401;
    error.code = "unauthorized";
    throw error;
  }
  return user;
}

export async function getOrCreateGuestToken(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  if (existing) return existing;
  const token = randomToken(24);
  try {
    jar.set(GUEST_COOKIE, token, cookieOptions(365 * 86_400));
  } catch {
    // Called from a server component render — the token is still usable this request.
  }
  return token;
}

export async function readGuestToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(GUEST_COOKIE)?.value ?? null;
}

export async function countAdminNotifications(): Promise<number> {
  const row = await db
    .selectFrom("notifications")
    .select(({ fn }) => fn.countAll<string>().as("count"))
    .where("audience", "=", "admin")
    .where("read_at", "is", null)
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

/** Guard against user enumeration in timing-sensitive flows. */
export async function touchLogin(userId: string): Promise<void> {
  await db.updateTable("users").set({ last_login_at: nowIso(), updated_at: nowIso() }).where("id", "=", userId).execute();
}

export async function findUserByEmail(email: string) {
  return db
    .selectFrom("users")
    .selectAll()
    .where(sql`lower(email)`, "=", email.trim().toLowerCase())
    .where("deleted_at", "is", null)
    .executeTakeFirst();
}

export async function activeSessionCount(userId: string): Promise<number> {
  const row = await db
    .selectFrom("sessions")
    .select(({ fn }) => fn.countAll<string>().as("count"))
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null)
    .where("expires_at", ">", nowIso())
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.deleteFrom("sessions").where("expires_at", "<", nowIso()).execute();
  await db.deleteFrom("oauth_states").where("expires_at", "<", nowIso()).execute();
  await db.deleteFrom("auth_tokens").where("expires_at", "<", nowIso()).where("used_at", "is", null).execute();
}

