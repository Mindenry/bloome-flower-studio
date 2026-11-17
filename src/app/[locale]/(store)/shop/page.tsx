import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListing } from "@/components/product-listing";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { getFilterFacets } from "@/lib/catalog";
import { parseShopFilters, firstParam, type RawSearchParams } from "@/lib/shop-params";
import { getNavData } from "@/lib/content";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "th";
  return {
    title: translate(locale, "seo.shop.title"),
    description: translate(locale, "seo.shop.description"),
    alternates: { canonical: `/${locale}/shop` },
  };
}

export default async function ShopPage({
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
  const filters = parseShopFilters(sp);
  const nav = await getNavData(locale);
  const categoryParam = firstParam(sp, "category");
  if (categoryParam) {
    const category = nav.categories.find((item) => item.slug === categoryParam);
    filters.categorySlug = category?.slug;
  }
  void getFilterFacets;

  return (
    <ProductListing
      locale={locale}
      eyebrow={translate(locale, "nav.shop")}
      title={translate(locale, "shop.title")}
      description={translate(locale, "shop.subtitle")}
      basePath={`/${locale}/shop`}
      searchParams={sp}
      filters={filters}
      breadcrumbs={[{ label: translate(locale, "nav.shop"), href: `/${locale}/shop` }]}
    />
  );
}
