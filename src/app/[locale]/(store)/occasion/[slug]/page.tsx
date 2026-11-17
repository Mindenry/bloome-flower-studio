import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductListing } from "@/components/product-listing";
import { getCategoryBySlug } from "@/lib/content";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { parseShopFilters, type RawSearchParams } from "@/lib/shop-params";
import { env } from "@/lib/env";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : "th";
  const occasion = await getCategoryBySlug(slug, locale);
  if (!occasion) return { title: translate(locale, "common.notFound") };
  return {
    title: occasion.name,
    description: occasion.description ?? translate(locale, "seo.shop.description"),
    alternates: {
      canonical: `${env.appUrl}/${locale}/occasion/${occasion.slug}`,
      languages: {
        th: `${env.appUrl}/th/occasion/${occasion.slug}`,
        en: `${env.appUrl}/en/occasion/${occasion.slug}`,
      },
    },
    openGraph: { title: occasion.name, description: occasion.description ?? undefined },
  };
}

export default async function OccasionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const [occasion, sp] = await Promise.all([getCategoryBySlug(slug, locale), searchParams]);
  if (!occasion) notFound();

  const filters = parseShopFilters(sp);
  filters.occasionSlug = occasion.slug;

  return (
    <ProductListing
      locale={locale}
      eyebrow={translate(locale, "nav.occasions")}
      title={occasion.name}
      description={occasion.description}
      basePath={`/${locale}/occasion/${occasion.slug}`}
      searchParams={sp}
      filters={filters}
      showCategoryFilter={false}
      heroImage={occasion.imageUrl}
      breadcrumbs={[
        { label: translate(locale, "nav.occasions"), href: `/${locale}/shop` },
        { label: occasion.name, href: `/${locale}/occasion/${occasion.slug}` },
      ]}
    />
  );
}
