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
  const category = await getCategoryBySlug(slug, locale);
  if (!category) return { title: translate(locale, "common.notFound") };
  return {
    title: category.metaTitle ?? category.name,
    description: category.metaDescription ?? category.description ?? translate(locale, "seo.shop.description"),
    alternates: {
      canonical: `${env.appUrl}/${locale}/category/${category.slug}`,
      languages: {
        th: `${env.appUrl}/th/category/${category.slug}`,
        en: `${env.appUrl}/en/category/${category.slug}`,
      },
    },
    openGraph: {
      title: category.name,
      description: category.description ?? undefined,
      images: category.imageUrl ? [category.imageUrl] : undefined,
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const [category, sp] = await Promise.all([getCategoryBySlug(slug, locale), searchParams]);
  if (!category) notFound();

  const filters = parseShopFilters(sp);
  filters.categorySlug = category.slug;

  return (
    <ProductListing
      locale={locale}
      eyebrow={category.kind === "collection" ? translate(locale, "nav.collections") : translate(locale, "nav.shop")}
      title={category.name}
      description={category.description}
      basePath={`/${locale}/category/${category.slug}`}
      searchParams={sp}
      filters={filters}
      showCategoryFilter={false}
      heroImage={category.imageUrl}
      breadcrumbs={[
        { label: translate(locale, "nav.shop"), href: `/${locale}/shop` },
        { label: category.name, href: `/${locale}/category/${category.slug}` },
      ]}
    />
  );
}
