import { NextResponse, type NextRequest } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  consumeOAuthState,
  exchangeCodeForProfile,
  resolveOAuthLogin,
  type OAuthProvider,
} from "@/lib/auth/oauth";
import { createSession, touchLogin, requestMeta } from "@/lib/auth/session";
import { mergeGuestCart } from "@/lib/cart";
import { asLocale, isLocale, type Locale } from "@/lib/i18n/config";
import { logActivity } from "@/lib/audit";

export const dynamic = "force-dynamic";

function localeFromPath(path: string): Locale {
  const segment = path.split("/").filter(Boolean)[0];
  return isLocale(segment) ? segment : "th";
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  const provider = rawProvider === "line" || rawProvider === "google" ? (rawProvider as OAuthProvider) : null;
  const url = new URL(request.url);
  const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? null;
  const fallbackLocale = asLocale(url.searchParams.get("locale"));

  if (!provider) {
    return NextResponse.redirect(new URL(`/${fallbackLocale}/login?error=unknown_provider`, request.url));
  }

  const providerError = url.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(new URL(`/${fallbackLocale}/login?error=access_denied`, request.url));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) {
    return NextResponse.redirect(new URL(`/${fallbackLocale}/login?error=missing_code`, request.url));
  }

  try {
    const stored = await consumeOAuthState(provider, state, stateCookie);
    const locale = localeFromPath(stored.redirectTo);
    const profile = await exchangeCodeForProfile(provider, code, stored.nonce, stored.codeVerifier);
    const resolution = await resolveOAuthLogin(provider, profile, {
      linkUserId: stored.linkUserId,
      locale,
    });

    if (resolution.kind === "link_required") {
      const target = new URL(`/${locale}/login`, request.url);
      target.searchParams.set("linkRequired", "1");
      target.searchParams.set("email", resolution.email);
      target.searchParams.set("provider", resolution.provider);
      return NextResponse.redirect(target);
    }

    if (resolution.kind === "linked") {
      const response = NextResponse.redirect(new URL(stored.redirectTo, request.url));
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    const meta = await requestMeta();
    await createSession(resolution.userId, meta);
    await touchLogin(resolution.userId);
    // Cookie writes inside a route handler are applied to the outgoing response;
    // the guest cart is merged on the next authenticated request through this helper.
    await mergeGuestCart(resolution.userId, request.cookies.get("bloome_guest")?.value ?? null, locale).catch(() => undefined);
    await logActivity({
      actor: null,
      actorEmail: profile.email,
      action: "auth.oauth_login",
      entityType: "user",
      entityId: resolution.userId,
      meta: { provider, created: resolution.created },
      ip: meta.ip,
    });

    const response = NextResponse.redirect(new URL(stored.redirectTo, request.url));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("[oauth] callback failed", (error as Error).message);
    const message = (error as Error).message;
    const reason = message.includes("invalid_oauth_state")
      ? "invalid_state"
      : message.includes("account_disabled")
        ? "account_disabled"
        : "callback_failed";
    return NextResponse.redirect(new URL(`/${fallbackLocale}/login?error=${reason}`, request.url));
  }
}
