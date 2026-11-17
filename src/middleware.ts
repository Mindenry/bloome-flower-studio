import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["th", "en"] as const;
const DEFAULT_LOCALE = "th";
const LOCALE_COOKIE = "bloome_locale";

function detectLocale(request: NextRequest): string {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && (LOCALES as readonly string[]).includes(cookie)) return cookie;
  const header = request.headers.get("accept-language")?.toLowerCase() ?? "";
  if (header.includes("th")) return "th";
  if (header.includes("en")) return "en";
  return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Public files, API routes and Next internals are never localised.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split("/").filter(Boolean);
  const hasLocale = segments.length > 0 && (LOCALES as readonly string[]).includes(segments[0]);

  if (hasLocale) {
    const response = NextResponse.next();
    const locale = segments[0];
    if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
      response.cookies.set(LOCALE_COOKIE, locale, {
        path: "/",
        maxAge: 365 * 86_400,
        sameSite: "lax",
      });
    }
    response.headers.set("x-bloome-locale", locale);
    return response;
  }

  const locale = detectLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
