import Link from "next/link";
import { ProductCard } from "./product-card";
import { Breadcrumbs, EmptyState, Pagination } from "./ui";
import { ActiveFilterChips, ShopFilters, SortSelect } from "./shop-filters";
import { IconSearch } from "./icons";
import { getFilterFacets, listProducts, type ProductFilters } from "@/lib/catalog";
import { getNavData } from "@/lib/content";
import { getCurrentUser } from "@/lib/auth/session";
import { getWishlistIds } from "@/lib/cart";
import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { buildQuery, firstParam, type RawSearchParams } from "@/lib/shop-params";
import { env } from "@/lib/env";

export async function ProductListing({
  locale,
  title,
  description,
  eyebrow,
  basePath,
  searchParams,
  filters,
  showFilters = true,
  showCategoryFilter = true,
  breadcrumbs = [],
  heroImage,
}: {
  locale: Locale;
  title: string;
  description?: string | null;
  eyebrow?: string;
  basePath: string;
  searchParams: RawSearchParams;
  filters: ProductFilters;
  showFilters?: boolean;
  showCategoryFilter?: boolean;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  heroImage?: string | null;
}) {
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const user = await getCurrentUser();
  const [result, facets, nav, wishlistIds] = await Promise.all([
    listProducts(locale, filters),
    getFilterFacets(locale),
    getNavData(locale),
    getWishlistIds(user?.id ?? null),
  ]);

  const current = {
    category: showCategoryFilter ? firstParam(searchParams, "category") : undefined,
    type: firstParam(searchParams, "type"),
    color: firstParam(searchParams, "color"),
    size: firstParam(searchParams, "size"),
    min: firstParam(searchParams, "min"),
    max: firstParam(searchParams, "max"),
    stock: firstParam(searchParams, "stock"),
    sale: firstParam(searchParams, "sale"),
  };

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    numberOfItems: result.total,
    itemListElement: result.items.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${env.appUrl}/${locale}/product/${product.slug}`,
      name: product.name,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: locale === "th" ? "หน้าแรก" : "Home", item: `${env.appUrl}/${locale}` },
      ...breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: crumb.label,
        ...(crumb.href ? { item: `${env.appUrl}${crumb.href}` } : {}),
      })),
    ],
  };

  return (
    <div className="container-page py-7 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {breadcrumbs.length > 0 ? (
        <Breadcrumbs items={[{ label: t("nav.home"), href: `/${locale}` }, ...breadcrumbs]} />
      ) : null}

      <header className="flex flex-col gap-4 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="mt-2 text-[28px] leading-tight sm:text-[36px]">{title}</h1>
          {description ? <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted">{description}</p> : null}
        </div>
        {heroImage ? (
          <div className="hidden h-24 w-36 overflow-hidden bg-[#f1efe8] sm:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        ) : null}
      </header>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <ActiveFilterChips
          basePath={basePath}
          current={current}
          categories={nav.categories.map((category) => ({ slug: category.slug, name: category.name }))}
          total={result.total}
        />
        <SortSelect basePath={basePath} />
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[232px_1fr] lg:gap-10">
        {showFilters ? (
          <ShopFilters
            basePath={basePath}
            facets={facets}
            categories={nav.categories.map((category) => ({ slug: category.slug, name: category.name }))}
            current={current}
            total={result.total}
            showCategories={showCategoryFilter}
          />
        ) : null}

        <div className="min-w-0">
          {result.items.length === 0 ? (
            <EmptyState
              title={t("shop.empty")}
              description={t("shop.emptyHint")}
              icon={<IconSearch size={28} />}
              action={
                <Link href={basePath} className="btn btn-outline btn-sm">
                  {t("shop.resetFilters")}
                </Link>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 md:grid-cols-3">
                {result.items.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    locale={locale}
                    inWishlist={wishlistIds.includes(product.id)}
                    returnTo={`${basePath}${buildQuery(searchParams)}`}
                    priority={index < 3}
                  />
                ))}
              </div>
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                buildHref={(page) => `${basePath}${buildQuery(searchParams, { page })}`}
                labels={{
                  previous: t("common.previous"),
                  next: t("common.next"),
                  page: t("common.page"),
                  of: t("common.of"),
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
