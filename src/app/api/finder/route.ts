import { NextResponse, type NextRequest } from "next/server";
import { listProducts } from "@/lib/catalog";
import { asLocale } from "@/lib/i18n/config";
import { rateLimit } from "@/lib/rate-limit";
import { toMinor } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`finder:${ip}`, 60, 60);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const url = new URL(request.url);
  const locale = asLocale(url.searchParams.get("locale"));
  const occasion = url.searchParams.get("occasion") ?? "";
  const budget = url.searchParams.get("budget") ?? "";
  const color = url.searchParams.get("color") ?? "";
  const type = url.searchParams.get("type") ?? "";

  const [minRaw, maxRaw] = budget.split("-");
  const minPrice = minRaw ? toMinor(Number(minRaw)) : undefined;
  const maxPrice = maxRaw ? toMinor(Number(maxRaw)) : undefined;

  const result = await listProducts(locale, {
    occasionSlug: occasion || undefined,
    color: color || undefined,
    flowerType: type || undefined,
    minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    inStock: true,
    perPage: 12,
    sort: "bestselling",
  });

  const fallback =
    result.items.length === 0
      ? await listProducts(locale, {
          color: color || undefined,
          minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
          maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
          perPage: 6,
          sort: "bestselling",
        })
      : null;

  const items = (result.items.length > 0 ? result.items : fallback?.items ?? []).map((item) => ({
    slug: item.slug,
    name: item.name,
    price: item.effectivePrice,
    compareAt: item.price !== item.effectivePrice ? item.price : null,
    imageUrl: item.imageUrl,
    soldOut: item.stockQuantity <= 0,
  }));

  return NextResponse.json(
    { items, exact: result.items.length > 0 },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
