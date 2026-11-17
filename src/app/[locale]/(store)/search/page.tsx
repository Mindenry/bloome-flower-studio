import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListing } from "@/components/product-listing";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { firstParam, parseShopFilters, type RawSearchParams } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const sp = await searchParams;
  const query = firstParam(sp, "q")?.trim() ?? "";
  const filters = parseShopFilters(sp);
  filters.query = query || undefined;

  return (
    <ProductListing
      locale={locale}
      eyebrow={translate(locale, "nav.search")}
      title={query ? `${translate(locale, "nav.search")}: “${query}”` : translate(locale, "nav.search")}
      description={translate(locale, "shop.subtitle")}
      basePath={`/${locale}/search`}
      searchParams={sp}
      filters={filters}
      showFilters={Boolean(query)}
      breadcrumbs={[{ label: translate(locale, "nav.search"), href: `/${locale}/search` }]}
    />
  );
}
