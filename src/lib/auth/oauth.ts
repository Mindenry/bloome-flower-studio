import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db, nowIso, parseJson } from "@/lib/db";
import { env } from "@/lib/env";
import { ids } from "@/lib/ids";
import type { Locale } from "@/lib/i18n/config";

export type OAuthProvider = "line" | "google";

export const OAUTH_STATE_COOKIE = "bloome_oauth_state";
const STATE_TTL_MINUTES = 10;

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const lineJwks = createRemoteJWKSet(new URL("https://api.line.me/oauth2/v2.1/certs"));

function base64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

export function isProviderConfigured(provider: OAuthProvider): boolean {
  return provider === "line" ? env.line.configured : env.google.configured;
}

export type StartedOAuth = { url: string; state: string };

export async function startOAuth(
  provider: OAuthProvider,
  options: { redirectTo?: string | null; linkUserId?: string | null } = {},
): Promise<StartedOAuth> {
  if (!isProviderConfigured(provider)) throw new Error(`${provider}_not_configured`);

  const state = base64url(randomBytes(32));
  const nonce = base64url(randomBytes(16));
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  const redirectTo = safeRedirectPath(options.redirectTo);

  await db
    .insertInto("oauth_states")
    .values({
      id: ids.oauthState(),
      provider,
      state,
      nonce,
      code_verifier: codeVerifier,
      redirect_to: redirectTo,
      link_user_id: options.linkUserId ?? null,
      expires_at: new Date(Date.now() + STATE_TTL_MINUTES * 60_000).toISOString(),
      created_at: nowIso(),
    })
    .execute();

  if (provider === "line") {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: env.line.channelId,
      redirect_uri: env.line.callbackUrl,
      state,
      scope: env.line.scope,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    return { state, url: `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}` };
  }

  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: env.google.callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });
  return { state, url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
}

function safeRedirectPath(path: string | null | undefined): string {
  if (!path) return "/account";
  if (!path.startsWith("/") || path.startsWith("//")) return "/account";
  return path.slice(0, 300);
}

export type OAuthProfile = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  claims: Record<string, unknown>;
};

export async function consumeOAuthState(
  provider: OAuthProvider,
  stateParam: string | null,
  cookieState: string | null,
): Promise<{ redirectTo: string; linkUserId: string | null; nonce: string; codeVerifier: string }> {
  if (!stateParam || !cookieState || stateParam !== cookieState) throw new Error("invalid_oauth_state");
  const row = await db
    .selectFrom("oauth_states")
    .selectAll()
    .where("state", "=", stateParam)
    .where("provider", "=", provider)
    .executeTakeFirst();
  if (!row) throw new Error("invalid_oauth_state");
  if (row.expires_at < nowIso()) {
    await db.deleteFrom("oauth_states").where("id", "=", row.id).execute();
    throw new Error("oauth_state_expired");
  }
  // Single use.
  await db.deleteFrom("oauth_states").where("id", "=", row.id).execute();
  return {
    redirectTo: safeRedirectPath(row.redirect_to),
    linkUserId: row.link_user_id,
    nonce: row.nonce ?? "",
    codeVerifier: row.code_verifier ?? "",
  };
}

export async function exchangeCodeForProfile(
  provider: OAuthProvider,
  code: string,
  nonce: string,
  codeVerifier: string,
): Promise<OAuthProfile> {
  if (provider === "line") {
    if (!env.line.configured) throw new Error("line_not_configured");
    const response = await fetch("https://api.line.me/oauth2/v2.1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: env.line.callbackUrl,
        client_id: env.line.channelId,
        client_secret: env.line.channelSecret,
        code_verifier: codeVerifier,
      }),
      cache: "no-store",
    });
    const token = (await response.json()) as {
      id_token?: string;
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !token.id_token) {
      throw new Error(`line_token_error:${token.error ?? response.status}`);
    }
    const { payload } = await jwtVerify(token.id_token, lineJwks, {
      issuer: "https://access.line.me",
      audience: env.line.channelId,
    });
    if (nonce && payload.nonce !== nonce) throw new Error("invalid_nonce");
    const email = typeof payload.email === "string" ? payload.email : null;
    return {
      sub: String(payload.sub),
      email,
      // LINE only returns the verified account email with the `email` scope.
      emailVerified: Boolean(email),
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
      claims: payload as Record<string, unknown>,
    };
  }

  if (!env.google.configured) throw new Error("google_not_configured");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: env.google.callbackUrl,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });
  const token = (await response.json()) as { id_token?: string; error?: string };
  if (!response.ok || !token.id_token) throw new Error(`google_token_error:${token.error ?? response.status}`);

  const { payload } = await jwtVerify(token.id_token, googleJwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.google.clientId,
  });
  if (nonce && payload.nonce !== nonce) throw new Error("invalid_nonce");
  return {
    sub: String(payload.sub),
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
    claims: payload as Record<string, unknown>,
  };
}

export type OAuthResolution =
  | { kind: "signed_in"; userId: string; created: boolean }
  | { kind: "link_required"; email: string; provider: OAuthProvider }
  | { kind: "linked"; userId: string };

async function customerRoleId(): Promise<string> {
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

/**
 * Sign-in rules:
 *  1. A linked provider account always wins.
 *  2. An explicitly signed-in user may link the provider (ownership already proven).
 *  3. Never auto-link by email — the caller must sign in with the existing
 *     account first, otherwise we surface `link_required`.
 */
export async function resolveOAuthLogin(
  provider: OAuthProvider,
  profile: OAuthProfile,
  options: { linkUserId?: string | null; locale: Locale },
): Promise<OAuthResolution> {
  const existingAccount = await db
    .selectFrom("accounts")
    .select(["user_id"])
    .where("provider", "=", provider)
    .where("provider_account_id", "=", profile.sub)
    .executeTakeFirst();

  if (options.linkUserId) {
    if (existingAccount && existingAccount.user_id !== options.linkUserId) {
      throw new Error("provider_already_linked");
    }
    if (!existingAccount) {
      await db
        .insertInto("accounts")
        .values({
          id: ids.account(),
          user_id: options.linkUserId,
          provider,
          provider_account_id: profile.sub,
          email: profile.email,
          display_name: profile.name,
          picture_url: profile.picture,
          created_at: nowIso(),
          updated_at: nowIso(),
        })
        .execute();
    }
    return { kind: "linked", userId: options.linkUserId };
  }

  if (existingAccount) {
    const user = await db
      .selectFrom("users")
      .select(["id", "status", "deleted_at", "avatar_url", "name"])
      .where("id", "=", existingAccount.user_id)
      .executeTakeFirst();
    if (!user || user.deleted_at) throw new Error("account_disabled");
    if (user.status !== "active") throw new Error("account_disabled");

    await db
      .updateTable("accounts")
      .set({
        email: profile.email,
        display_name: profile.name,
        picture_url: profile.picture,
        updated_at: nowIso(),
      })
      .where("provider", "=", provider)
      .where("provider_account_id", "=", profile.sub)
      .execute();

    if (profile.email && !user.avatar_url) {
      await db.updateTable("users").set({ avatar_url: profile.picture, updated_at: nowIso() }).where("id", "=", user.id).execute();
    }
    return { kind: "signed_in", userId: user.id, created: false };
  }

  if (profile.email) {
    const emailOwner = await db
      .selectFrom("users")
      .select("id")
      .where("email", "=", profile.email)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    if (emailOwner) return { kind: "link_required", email: profile.email, provider };
  }

  const roleId = await customerRoleId();
  const userId = ids.user();
  const now = nowIso();
  await db.transaction().execute(async (tx) => {
    await tx
      .insertInto("users")
      .values({
        id: userId,
        email: profile.email,
        email_verified_at: profile.emailVerified ? now : null,
        password_hash: null,
        name: profile.name ?? profile.email?.split("@")[0] ?? "BLOOMÉ customer",
        phone: null,
        avatar_url: profile.picture,
        role_id: roleId,
        status: "active",
        locale: options.locale,
        marketing_consent: 0,
        last_login_at: now,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .execute();
    await tx
      .insertInto("accounts")
      .values({
        id: ids.account(),
        user_id: userId,
        provider,
        provider_account_id: profile.sub,
        email: profile.email,
        display_name: profile.name,
        picture_url: profile.picture,
        created_at: now,
        updated_at: now,
      })
      .execute();
  });
  return { kind: "signed_in", userId, created: true };
}

export async function unlinkProvider(userId: string, provider: OAuthProvider): Promise<{ ok: boolean; error?: string }> {
  const user = await db
    .selectFrom("users")
    .select(["password_hash"])
    .where("id", "=", userId)
    .executeTakeFirst();
  const accounts = await db.selectFrom("accounts").select("id").where("user_id", "=", userId).execute();
  if (!user) return { ok: false, error: "common.notFound" };
  if (!user.password_hash && accounts.length <= 1) return { ok: false, error: "auth.linkRequired" };
  await db.deleteFrom("accounts").where("user_id", "=", userId).where("provider", "=", provider).execute();
  return { ok: true };
}

export async function linkedProviders(userId: string): Promise<Array<{ provider: string; email: string | null }>> {
  const rows = await db
    .selectFrom("accounts")
    .select(["provider", "email"])
    .where("user_id", "=", userId)
    .execute();
  void parseJson;
  return rows;
}
