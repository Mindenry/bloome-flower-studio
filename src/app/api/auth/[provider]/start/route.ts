import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { startOAuth, OAUTH_STATE_COOKIE, type OAuthProvider } from "@/lib/auth/oauth";
import { env } from "@/lib/env";
import { asLocale } from "@/lib/i18n/config";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  const provider = rawProvider === "line" || rawProvider === "google" ? (rawProvider as OAuthProvider) : null;
  const url = new URL(request.url);
  const locale = asLocale(url.searchParams.get("locale"));
  if (!provider) return NextResponse.redirect(new URL(`/${locale}/login?error=unknown_provider`, request.url));

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`oauth:${provider}:${ip}`, 20, 300);
  if (!limit.ok) return NextResponse.redirect(new URL(`/${locale}/login?error=rate_limited`, request.url));

  const configured =
    provider === "line" ? env.line.configured : env.google.configured;
  if (!configured) {
    return NextResponse.redirect(new URL(`/${locale}/login?error=not_configured`, request.url));
  }

  const next = url.searchParams.get("next");
  const link = url.searchParams.get("link") === "1";
  const user = await getCurrentUser();
  if (link && !user) {
    return NextResponse.redirect(new URL(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account/security`)}`, request.url));
  }

  try {
    const { url: authorizeUrl, state } = await startOAuth(provider, {
      redirectTo: link ? `/${locale}/account/security?linked=${provider}` : next ?? `/${locale}/account`,
      linkUserId: link ? user?.id ?? null : null,
    });

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (error) {
    console.error("[oauth] start failed", (error as Error).message);
    return NextResponse.redirect(new URL(`/${locale}/login?error=start_failed`, request.url));
  }
}
