import { NextResponse, type NextRequest } from "next/server";
import { listProducts, getPopularSearches } from "@/lib/catalog";
import { getNavData } from "@/lib/content";
import { asLocale } from "@/lib/i18n/config";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`suggest:${ip}`, 120, 60);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const locale = asLocale(url.searchParams.get("locale"));

  const [nav, popular] = await Promise.all([getNavData(locale), getPopularSearches()]);

  if (query.length < 2) {
    return NextResponse.json(
      {
        products: [],
        categories: [],
        popular: popular.slice(0, 6),
      },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  }

  const { items } = await listProducts(locale, { query, perPage: 5, sort: "bestselling" });
  const lowered = query.toLowerCase();
  const categories = [...nav.categories, ...nav.occasions, ...nav.collections]
    .filter((item) => item.name.toLowerCase().includes(lowered) || item.slug.includes(lowered))
    .slice(0, 6)
    .map((item) => ({ slug: item.slug, name: item.name, kind: nav.occasions.some((o) => o.slug === item.slug) ? "occasion" : "category" }));

  return NextResponse.json(
    {
      products: items.map((item) => ({
        slug: item.slug,
        name: item.name,
        price: item.effectivePrice,
        imageUrl: item.imageUrl,
      })),
      categories,
      popular: popular.slice(0, 6),
    },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
