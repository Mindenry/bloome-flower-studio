import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AddToCartForm } from "@/components/add-to-cart-form";
import { ProductGallery } from "@/components/product-gallery";
import { ProductCard } from "@/components/product-card";
import { ProductBuyBar } from "@/components/product-buy-bar";
import { Breadcrumbs, RatingStars, Price, Badge } from "@/components/ui";
import { IconChevronDown, IconLeaf, IconPen, IconTruck } from "@/components/icons";
import { getProductBySlug, getRelatedProducts, incrementProductView, listAddons } from "@/lib/catalog";
import { getProductReviews, maskName } from "@/lib/content";
import { getWishlistIds, recordRecentlyViewed } from "@/lib/cart";
import { getCurrentUser, readGuestToken } from "@/lib/auth/session";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/time";
import { getSettings } from "@/lib/settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : "th";
  const product = await getProductBySlug(locale, slug);
  if (!product) return { title: locale === "th" ? "ไม่พบสินค้า" : "Product not found" };
  const title = product.metaTitle ?? product.name;
  const description = product.metaDescription ?? product.shortDescription ?? "";
  const image = product.images[0]?.url ?? "/images/og-default.jpg";
  return {
    title,
    description,
    alternates: {
      canonical: `${env.appUrl}/${locale}/product/${product.slug}`,
      languages: {
        th: `${env.appUrl}/th/product/${product.slug}`,
        en: `${env.appUrl}/en/product/${product.slug}`,
      },
    },
    openGraph: { title, description, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const [product, user, addons] = await Promise.all([
    getProductBySlug(locale, slug),
    getCurrentUser(),
    listAddons(locale),
  ]);
  if (!product) notFound();

  const [reviews, related, wishlistIds, settings] = await Promise.all([
    getProductReviews(product.id),
    getRelatedProducts(locale, product.id, product.categoryId),
    getWishlistIds(user?.id ?? null),
    getSettings(),
  ]);

  const bangkokHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false }).format(new Date()),
  );
  const sameDayAvailable = settings.shipping.sameDayEnabled && bangkokHour < settings.shipping.cutoffHour;
  const cutoffLabel = `${String(settings.shipping.cutoffHour).padStart(2, "0")}:00`;
  const deliveryEstimate =
    locale === "th"
      ? sameDayAvailable
        ? `สั่งก่อน ${cutoffLabel} น. จัดส่งวันนี้ได้`
        : `จัดส่งวันถัดไป — สั่งก่อน ${cutoffLabel} น. เพื่อรับเร็วขึ้น`
      : sameDayAvailable
        ? `Order before ${cutoffLabel} for same-day delivery`
        : `Next-day delivery — order before ${cutoffLabel} to go sooner`;

  // Non-blocking: record the view for the "recently viewed" carousel.
  incrementProductView(product.id).catch(() => undefined);
  recordRecentlyViewed(user?.id ?? null, user ? null : await readGuestToken(), product.id).catch(() => undefined);


  const ratingDistribution = product.ratingBreakdown;
  const totalReviews = product.reviewCount;

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description ?? "",
    sku: product.sku,
    image: product.images.map((image) =>
      image.url.startsWith("http") ? image.url : `${env.appUrl}${image.url}`,
    ),
    brand: { "@type": "Brand", name: "BLOOMÉ FLOWER STUDIO" },
    offers: {
      "@type": "Offer",
      url: `${env.appUrl}/${locale}/product/${product.slug}`,
      priceCurrency: "THB",
      price: (product.effectivePrice / 100).toFixed(2),
      priceValidUntil: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      availability: product.stockQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "BLOOMÉ FLOWER STUDIO" },
    },
    ...(totalReviews > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.ratingAvg,
            reviewCount: totalReviews,
          },
        }
      : {}),
  };

  return (
    <div className="container-page py-8 pb-24 md:py-12 lg:pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <Breadcrumbs
        items={[
          { label: locale === "th" ? "หน้าแรก" : "Home", href: `/${locale}` },
          { label: t("nav.shop"), href: `/${locale}/shop` },
          ...(product.categoryName && product.categorySlug
            ? [{ label: product.categoryName, href: `/${locale}/category/${product.categorySlug}` }]
            : []),
          { label: product.name },
        ]}
      />

      <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <ProductGallery images={product.images.length ? product.images : product.imageUrl ? [{ id: "main", url: product.imageUrl, alt: product.name }] : []} />

        <div className="lg:sticky lg:top-28 lg:self-start">
          {product.categoryName && product.categorySlug ? (
            <Link
              href={`/${locale}/category/${product.categorySlug}`}
              className="eyebrow hover:text-primary-dark"
            >
              {product.categoryName}
            </Link>
          ) : null}
          <h1 className="mt-3 text-[30px] leading-tight sm:text-[38px]">{product.name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Price value={product.effectivePrice} compareAt={product.price} locale={locale} size="lg" />
            {product.reviewCount > 0 ? (
              <a href="#reviews" className="flex items-center gap-2 text-xs text-muted hover:text-primary-dark">
                <RatingStars value={product.ratingAvg} size={13} />
                <span>
                  {product.ratingAvg} · {product.reviewCount} {t("product.reviews")}
                </span>
              </a>
            ) : (
              <span className="text-xs text-muted">{t("product.noReviews")}</span>
            )}
          </div>

          {product.shortDescription ? (
            <p className="mt-5 border-t border-line pt-5 text-sm leading-relaxed text-muted">{product.shortDescription}</p>
          ) : null}

          {product.occasions.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted">
                {locale === "th" ? "เหมาะกับ" : "For"}
              </span>
              {product.occasions.map((occasion) => (
                <Link
                  key={occasion.slug}
                  href={`/${locale}/occasion/${occasion.slug}`}
                  className="border border-line bg-white px-2.5 py-1 text-[11px] text-charcoal transition-colors hover:border-primary hover:text-primary-dark"
                >
                  {occasion.name}
                </Link>
              ))}
            </div>
          ) : null}

          <p className="mt-4 flex items-center gap-2 text-[11px] text-primary-dark">
            <IconTruck size={14} />
            {deliveryEstimate}
          </p>

          <div id="buy-form" className="mt-6 scroll-mt-28">
            <AddToCartForm
              productId={product.id}
              price={product.effectivePrice}
              stock={product.stockQuantity}
              variants={product.variants}
              addons={product.addons.length ? product.addons : addons}
              hasVariants={product.variants.length > 0}
            />
          </div>

          <ul className="mt-8 space-y-2.5 border-t border-line pt-6 text-xs text-muted">
            <li className="flex items-center gap-3">
              <IconTruck size={16} className="text-primary" />
              {locale === "th" ? "จัดส่งด่วนภายในวันเดียวกัน (สั่งก่อน 14:00 น.)" : "Same-day delivery when ordered before 14:00"}
            </li>
            <li className="flex items-center gap-3">
              <IconLeaf size={16} className="text-primary" />
              {locale === "th" ? "ดอกไม้สดคัดสรรในเช้าวันส่งมอบ" : "Stems selected fresh on the morning of delivery"}
            </li>
            <li className="flex items-center gap-3">
              <IconPen size={16} className="text-primary" />
              {locale === "th" ? "การ์ดข้อความเขียนมือฟรี" : "Complimentary handwritten card"}
            </li>
          </ul>

          <div className="mt-8 divide-y divide-line border-y border-line">
            <details className="group" open>
              <summary className="flex cursor-pointer items-center justify-between py-4 text-sm">
                {t("product.description")}
                <IconChevronDown size={16} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="prose-editorial pb-5 text-sm">{product.description}</div>
            </details>
            {product.careInstructions ? (
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between py-4 text-sm">
                  {t("product.care")}
                  <IconChevronDown size={16} className="transition-transform group-open:rotate-180" />
                </summary>
                <div className="prose-editorial pb-5 text-sm">{product.careInstructions}</div>
              </details>
            ) : null}
            {product.deliveryInformation ? (
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between py-4 text-sm">
                  {t("product.delivery")}
                  <IconChevronDown size={16} className="transition-transform group-open:rotate-180" />
                </summary>
                <div className="prose-editorial pb-5 text-sm">{product.deliveryInformation}</div>
              </details>
            ) : null}
            <details className="group">
              <summary className="flex cursor-pointer items-center justify-between py-4 text-sm">
                {t("product.details")}
                <IconChevronDown size={16} className="transition-transform group-open:rotate-180" />
              </summary>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 pb-5 text-xs text-muted">
                <dt>{t("product.sku")}</dt>
                <dd className="text-charcoal">{product.sku}</dd>
                {product.flowerType ? (
                  <>
                    <dt>{t("product.flowers")}</dt>
                    <dd className="text-charcoal">{product.flowerType}</dd>
                  </>
                ) : null}
                {product.flowerColor ? (
                  <>
                    <dt>{t("product.color")}</dt>
                    <dd className="text-charcoal">{product.flowerColor}</dd>
                  </>
                ) : null}
                {product.bouquetSize ? (
                  <>
                    <dt>{t("product.size")}</dt>
                    <dd className="text-charcoal">{product.bouquetSize}</dd>
                  </>
                ) : null}
                {product.flowerCount ? (
                  <>
                    <dt>{t("product.count")}</dt>
                    <dd className="text-charcoal">{product.flowerCount}</dd>
                  </>
                ) : null}
              </dl>
            </details>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section id="reviews" className="mt-20 scroll-mt-28 border-t border-line pt-14">
        <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
          <div>
            <h2 className="text-[26px]">{t("product.reviews")}</h2>
            <div className="mt-4 flex items-end gap-3">
              <span className="font-serif text-4xl">{product.ratingAvg || "—"}</span>
              <div className="pb-1">
                <RatingStars value={product.ratingAvg} />
                <p className="mt-1 text-xs text-muted">
                  {totalReviews} {t("product.reviews")}
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingDistribution[star - 1] ?? 0;
                const width = totalReviews ? Math.round((count / totalReviews) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-[11px] text-muted">
                    <span className="w-3">{star}</span>
                    <span className="h-1.5 flex-1 bg-line">
                      <span className="block h-full bg-primary" style={{ width: `${width}%` }} />
                    </span>
                    <span className="w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            {reviews.length === 0 ? (
              <p className="border border-line bg-white px-6 py-10 text-sm text-muted">{t("product.noReviews")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {reviews.map((review) => (
                  <li key={review.id} className="py-6 first:pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <RatingStars value={review.rating} size={13} />
                        <span className="text-sm">{maskName(review.authorName)}</span>
                        {review.verified ? <Badge tone="success">{t("product.verifiedPurchase")}</Badge> : null}
                      </div>
                      <span className="text-[11px] text-muted">
                        {formatDate(review.createdAt, locale, { dateStyle: "medium" })}
                      </span>
                    </div>
                    {review.title ? <p className="mt-3 font-medium">{review.title}</p> : null}
                    <p className="mt-2 text-sm leading-relaxed text-muted">{review.body}</p>
                    {review.images.length > 0 ? (
                      <div className="mt-3 flex gap-2">
                        {review.images.map((image) => (
                          <div key={image} className="relative h-16 w-16 overflow-hidden border border-line">
                            <Image src={image} alt="" fill sizes="64px" className="object-cover" />
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {review.adminReply ? (
                      <div className="mt-4 border-l-2 border-primary bg-primary-soft px-4 py-3 text-sm">
                        <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-primary-dark">BLOOMÉ</p>
                        {review.adminReply}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {related.length > 0 ? (
        <section className="mt-20 border-t border-line pt-14">
          <h2 className="text-[26px]">{t("product.related")}</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 md:grid-cols-4">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                locale={locale}
                inWishlist={wishlistIds.includes(item.id)}
                returnTo={`/${locale}/product/${product.slug}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      <ProductBuyBar productName={product.name} priceLabel={new Intl.NumberFormat(locale === "en" ? "en-US" : "th-TH").format(product.effectivePrice / 100)} />
    </div>
  );
}
