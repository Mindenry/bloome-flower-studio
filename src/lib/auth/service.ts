import { createHash } from "node:crypto";
import { db, hoursFromNow, nowIso } from "@/lib/db";
import { ids, randomToken } from "@/lib/ids";
import { hashPassword, verifyPassword, hashToken } from "@/lib/auth/password";
import { createSession, requestMeta, touchLogin, revokeAllSessions, findUserByEmail } from "@/lib/auth/session";
import { mergeGuestCart } from "@/lib/cart";
import { rateLimit } from "@/lib/rate-limit";
import { sendResetEmail, sendVerificationEmail } from "@/lib/email";
import { logActivity } from "@/lib/audit";
import type { Locale } from "@/lib/i18n/config";

export type AuthResult = { ok: true; userId: string } | { ok: false; error: string };

function limiterKey(scope: string, value: string): string {
  return `${scope}:${createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 40)}`;
}

async function getCustomerRoleId(): Promise<string> {
  const role = await db.selectFrom("roles").select("id").where("slug", "=", "customer").executeTakeFirst();
  if (role) return role.id;
  const id = ids.role();
  await db
    .insertInto("roles")
    .values({
      id,
      slug: "customer",
      name: "Customer",
      description: "Storefront customer",
      permissions: "[]",
      is_system: 1,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .execute();
  return id;
}

export async function registerUser(
  input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    marketingConsent?: boolean;
    locale: Locale;
  },
  guestToken: string | null,
): Promise<AuthResult> {
  const limit = await rateLimit(limiterKey("register", input.email), 5, 900);
  if (!limit.ok) return { ok: false, error: "error.rateLimit" };

  const existing = await findUserByEmail(input.email);
  if (existing) return { ok: false, error: "auth.emailTaken" };

  const roleId = await getCustomerRoleId();
  const userId = ids.user();
  const now = nowIso();
  try {
    await db
      .insertInto("users")
      .values({
        id: userId,
        email: input.email,
        email_verified_at: null,
        password_hash: await hashPassword(input.password),
        name: input.name,
        phone: input.phone || null,
        avatar_url: null,
        role_id: roleId,
        status: "active",
        locale: input.locale,
        marketing_consent: input.marketingConsent ? 1 : 0,
        last_login_at: now,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .execute();
  } catch {
    return { ok: false, error: "auth.emailTaken" };
  }

  await issueVerification(userId, input.locale);
  const meta = await requestMeta();
  await createSession(userId, meta);
  await mergeGuestCart(userId, guestToken, input.locale);
  await logActivity({
    actor: null,
    actorEmail: input.email,
    action: "auth.register",
    entityType: "user",
    entityId: userId,
    ip: meta.ip,
  });
  return { ok: true, userId };
}

export async function issueVerification(userId: string, locale: Locale): Promise<void> {
  const user = await db.selectFrom("users").select(["id", "email", "name"]).where("id", "=", userId).executeTakeFirst();
  if (!user?.email) return;
  const token = randomToken(32);
  await db
    .insertInto("auth_tokens")
    .values({
      id: ids.token(),
      user_id: userId,
      type: "email_verification",
      token_hash: await hashToken(token),
      expires_at: hoursFromNow(48),
      used_at: null,
      created_at: nowIso(),
    })
    .execute();
  await sendVerificationEmail({ to: user.email, locale, name: user.name, token });
}

export async function verifyEmailToken(token: string): Promise<AuthResult> {
  const hash = await hashToken(token);
  const row = await db
    .selectFrom("auth_tokens")
    .selectAll()
    .where("token_hash", "=", hash)
    .where("type", "=", "email_verification")
    .where("used_at", "is", null)
    .executeTakeFirst();
  if (!row || row.expires_at < nowIso()) return { ok: false, error: "auth.verify.invalid" };

  const now = nowIso();
  await db.transaction().execute(async (tx) => {
    await tx.updateTable("auth_tokens").set({ used_at: now }).where("id", "=", row.id).execute();
    await tx
      .updateTable("users")
      .set({ email_verified_at: now, updated_at: now })
      .where("id", "=", row.user_id)
      .execute();
  });
  return { ok: true, userId: row.user_id };
}

export async function authenticate(
  input: { email: string; password: string },
  guestToken: string | null,
): Promise<AuthResult> {
  const meta = await requestMeta();
  const perEmail = await rateLimit(limiterKey("login", input.email), 8, 600);
  const perIp = await rateLimit(limiterKey("login_ip", meta.ip ?? "unknown"), 30, 600);
  if (!perEmail.ok || !perIp.ok) return { ok: false, error: "error.rateLimit" };

  const user = await findUserByEmail(input.email);
  // Constant-ish work whether or not the user exists.
  const valid = await verifyPassword(input.password, user?.password_hash ?? null);
  if (!user || !valid) return { ok: false, error: "auth.invalidCredentials" };
  if (user.status !== "active") return { ok: false, error: "auth.accountDisabled" };

  await createSession(user.id, meta);
  await touchLogin(user.id);
  await mergeGuestCart(user.id, guestToken, (user.locale as Locale) ?? "th");
  await logActivity({
    actor: null,
    actorEmail: user.email,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    ip: meta.ip,
  });
  return { ok: true, userId: user.id };
}

export async function requestPasswordReset(email: string, locale: Locale): Promise<{ ok: true }> {
  const limit = await rateLimit(limiterKey("reset", email), 4, 900);
  if (!limit.ok) return { ok: true }; // do not leak rate limits for enumeration

  const user = await findUserByEmail(email);
  if (user && user.status === "active" && user.email) {
    const token = randomToken(32);
    await db
      .insertInto("auth_tokens")
      .values({
        id: ids.token(),
        user_id: user.id,
        type: "password_reset",
        token_hash: await hashToken(token),
        expires_at: hoursFromNow(1),
        used_at: null,
        created_at: nowIso(),
      })
      .execute();
    await sendResetEmail({ to: user.email, locale, name: user.name, token });
  }
  return { ok: true };
}

export async function resetPassword(token: string, password: string): Promise<AuthResult> {
  const hash = await hashToken(token);
  const row = await db
    .selectFrom("auth_tokens")
    .selectAll()
    .where("token_hash", "=", hash)
    .where("type", "=", "password_reset")
    .where("used_at", "is", null)
    .executeTakeFirst();
  if (!row || row.expires_at < nowIso()) return { ok: false, error: "auth.reset.invalid" };

  const passwordHash = await hashPassword(password);
  const now = nowIso();
  await db.transaction().execute(async (tx) => {
    await tx.updateTable("auth_tokens").set({ used_at: now }).where("id", "=", row.id).execute();
    await tx
      .updateTable("users")
      .set({ password_hash: passwordHash, updated_at: now })
      .where("id", "=", row.user_id)
      .execute();
    await tx
      .updateTable("auth_tokens")
      .set({ used_at: now })
      .where("user_id", "=", row.user_id)
      .where("type", "=", "password_reset")
      .where("used_at", "is", null)
      .execute();
  });
  await revokeAllSessions(row.user_id);
  return { ok: true, userId: row.user_id };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await db.selectFrom("users").select(["password_hash"]).where("id", "=", userId).executeTakeFirst();
  if (!user) return { ok: false, error: "common.notFound" };
  if (!user.password_hash) return { ok: false, error: "account.passwordOAuthNote" };
  if (!(await verifyPassword(currentPassword, user.password_hash))) {
    return { ok: false, error: "auth.invalidCredentials" };
  }
  await db
    .updateTable("users")
    .set({ password_hash: await hashPassword(newPassword), updated_at: nowIso() })
    .where("id", "=", userId)
    .execute();
  await revokeAllSessions(userId, currentSessionId);
  return { ok: true };
}

/** PDPA account deletion: anonymise personal data, retain financial records. */
export async function deleteAccount(userId: string): Promise<void> {
  const now = nowIso();
  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable("users")
      .set({
        email: null,
        name: "Deleted customer",
        phone: null,
        avatar_url: null,
        status: "disabled",
        deleted_at: now,
        updated_at: now,
        password_hash: null,
        marketing_consent: 0,
      })
      .where("id", "=", userId)
      .execute();
    await tx.deleteFrom("accounts").where("user_id", "=", userId).execute();
    await tx.updateTable("sessions").set({ revoked_at: now }).where("user_id", "=", userId).execute();
    await tx.deleteFrom("addresses").where("user_id", "=", userId).execute();
    await tx.deleteFrom("recipients").where("user_id", "=", userId).execute();
    await tx.deleteFrom("occasion_reminders").where("user_id", "=", userId).execute();
    await tx.deleteFrom("wishlists").where("user_id", "=", userId).execute();
    await tx.deleteFrom("recently_viewed").where("user_id", "=", userId).execute();
    await tx.deleteFrom("notifications").where("user_id", "=", userId).execute();
  });
}
