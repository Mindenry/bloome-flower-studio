import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductCard } from "@/components/product-card";
import { NewsletterForm } from "@/components/newsletter-form";
import { RatingStars, SectionHeading } from "@/components/ui";
import {
  IconArrowRight,
  IconCalendar,
  IconInstagram,
  IconLeaf,
  IconPen,
  IconShield,
  IconTruck,
} from "@/components/icons";
import { getActiveBanners, getGallery, getHomepageReviews, getNavData, getReviewAggregate } from "@/lib/content";
import { listProducts } from "@/lib/catalog";
import { getWishlistIds } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "th";
  const settings = await getSettings();
  return {
    title: locale === "th" ? settings.seo.titleTh : settings.seo.titleEn,
    description: locale === "th" ? settings.seo.descriptionTh : settings.seo.descriptionEn,
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const user = await getCurrentUser();
  const [settings, nav, heroBanners, specialBanners, bestSellers, newArrivals, reviews, gallery, wishlistIds, reviewAggregate] =
    await Promise.all([
      getSettings(),
      getNavData(locale),
      getActiveBanners("home_hero", locale),
      getActiveBanners("home_special", locale),
      listProducts(locale, { sort: "bestselling", perPage: 4, inStock: true }),
      listProducts(locale, { sort: "newest", perPage: 4, newArrival: true }),
      getHomepageReviews(locale, 6),
      getGallery(),
      getWishlistIds(user?.id ?? null),
      getReviewAggregate(),
    ]);

  const hero = heroBanners[0];
  const special = specialBanners[0];
  const heroImage = hero?.imageUrl ?? "/uploads/seed/pexels/florist-08.webp";

  const occasionIcons = nav.occasions.slice(0, 8);

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-line bg-cream">
        <div className="container-page grid items-stretch gap-0 lg:grid-cols-[1.05fr_1fr]">
          <div className="flex flex-col justify-center py-14 pr-0 lg:py-24 lg:pr-16">
            <p className="eyebrow animate-[fade-in_0.8s_ease_both]">{t("home.hero.eyebrow")}</p>
            <h1 className="mt-5 text-[34px] leading-[1.2] animate-[fade-up_0.9s_cubic-bezier(0.22,1,0.36,1)_both] sm:text-[44px] lg:text-[52px] lg:leading-[1.15]">
              {hero?.title ?? t("home.hero.title")}
            </h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
              {hero?.subtitle ?? t("home.hero.subtitle")}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href={`/${locale}${hero?.linkUrl && hero.linkUrl.startsWith("/") ? hero.linkUrl : "/shop"}`}
                className="btn btn-primary"
              >
                {hero?.cta ?? t("home.hero.ctaPrimary")}
              </Link>
              <Link href={`/${locale}/contact`} className="btn btn-ghost">
                {t("home.hero.ctaSecondary")}
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] uppercase tracking-[0.16em] text-muted">
              <span className="flex items-center gap-2">
                <IconTruck size={16} className="text-primary" />
                {t("home.service.sameday")}
              </span>
              <span className="flex items-center gap-2">
                <IconLeaf size={16} className="text-primary" />
                {t("home.service.fresh")}
              </span>
              {reviewAggregate.count > 0 ? (
                <span className="flex items-center gap-2 normal-case tracking-normal">
                  <RatingStars value={reviewAggregate.average} size={13} />
                  <span className="text-[12px] text-charcoal">
                    {reviewAggregate.average} · {reviewAggregate.count} {t("product.reviews")}
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="relative min-h-[380px] lg:min-h-[640px]">
            <Image
              src={heroImage}
              alt={hero?.title ?? settings.store.tagline}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 48vw"
              className="object-cover"
            />
            <div className="absolute bottom-6 left-6 right-6 hidden items-center justify-between gap-4 border border-white/40 bg-white/85 px-5 py-4 backdrop-blur sm:flex">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-muted">{t("home.service.sameday")}</p>
                <p className="mt-1 text-sm">{locale === "th" ? "สั่งก่อน 14:00 น." : "Order before 14:00"}</p>
              </div>
              <Link href={`/${locale}/shop`} className="text-primary-dark" aria-label={t("nav.shop")}>
                <IconArrowRight size={22} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Service strip */}
      <section className="border-b border-line bg-white">
        <div className="container-page grid grid-cols-2 gap-6 py-7 md:grid-cols-4">
          {[
            { icon: IconTruck, label: t("home.service.sameday") },
            { icon: IconLeaf, label: t("home.service.fresh") },
            { icon: IconPen, label: t("home.service.handwritten") },
            { icon: IconShield, label: t("home.service.secure") },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-center gap-3 text-xs text-muted">
              <item.icon size={18} className="text-primary" />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container-page py-20 md:py-24">
        <SectionHeading
          eyebrow={locale === "th" ? "คอลเลกชัน" : "Collections"}
          title={t("home.categories.title")}
          description={t("home.categories.subtitle")}
          action={
            <Link href={`/${locale}/shop`} className="group inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary-dark">
              {t("nav.viewAll")}
              <IconArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          }
        />
        <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4">
          {nav.categories.slice(0, 4).map((category) => (
            <Link key={category.slug} href={`/${locale}/category/${category.slug}`} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden bg-[#f1efe8]">
                {category.imageUrl ? (
                  <Image
                    src={category.imageUrl}
                    alt={category.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition-transform duration-[900ms] group-hover:scale-[1.05]"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-4">
                  <span className="font-serif text-lg text-white">{category.name}</span>
                  <IconArrowRight size={18} className="text-white/80 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Best sellers */}
      {bestSellers.items.length > 0 ? (
        <section className="border-y border-line bg-white">
          <div className="container-page py-20 md:py-24">
            <SectionHeading
              eyebrow={locale === "th" ? "คัดจากยอดสั่งซื้อจริง" : "Ranked by real orders"}
              title={t("home.bestsellers.title")}
              description={t("home.bestsellers.subtitle")}
              action={
                <Link href={`/${locale}/shop?sort=bestselling`} className="group inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary-dark">
                  {t("nav.viewAll")}
                  <IconArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </Link>
              }
            />
            <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 md:grid-cols-4">
              {bestSellers.items.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  locale={locale}
                  inWishlist={wishlistIds.includes(product.id)}
                  returnTo={`/${locale}`}
                    />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Brand story */}
      <section className="container-page py-20 md:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="relative aspect-[4/5] overflow-hidden bg-[#f1efe8] lg:aspect-[5/6]">
            <Image
              src={gallery[1]?.image_url ?? gallery[0]?.image_url ?? "/uploads/seed/pexels/shop-08.webp"}
              alt={t("home.brand.title")}
              fill
              sizes="(max-width: 1024px) 100vw, 46vw"
              className="object-cover"
            />
          </div>
          <div className="lg:pl-10">
            <p className="eyebrow">{locale === "th" ? "เรื่องราวของเรา" : "Our story"}</p>
            <h2 className="mt-4 text-[30px] leading-tight sm:text-[38px]">{t("home.brand.title")}</h2>
            <p className="mt-6 text-[15px] leading-relaxed text-muted">{t("home.brand.body")}</p>
            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-line pt-7">
              {[
                { value: "8", label: t("home.brand.stat1") },
                { value: "12,400+", label: t("home.brand.stat2") },
                { value: "4.9", label: t("home.brand.stat3") },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-serif text-[26px] text-primary-dark">{stat.value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted">{stat.label}</p>
                </div>
              ))}
            </div>
            <Link href={`/${locale}/about`} className="btn btn-outline mt-9">
              {t("home.brand.cta")}
            </Link>
          </div>
        </div>
      </section>

      {/* Special collection */}
      {special ? (
        <section className="bg-primary-dark text-white">
          <div className="container-page grid gap-0 lg:grid-cols-2">
            <div className="flex flex-col justify-center py-16 lg:py-24 lg:pr-16">
              <p className="text-[10px] uppercase tracking-[0.32em] text-white/60">
                {locale === "th" ? "คอลเลกชันพิเศษ" : "Special collection"}
              </p>
              <h2 className="mt-4 text-[30px] leading-tight text-white sm:text-[40px]">{special.title}</h2>
              {special.subtitle ? (
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">{special.subtitle}</p>
              ) : null}
              <div className="mt-8">
                <Link
                  href={`/${locale}${special.linkUrl?.startsWith("/") ? special.linkUrl : "/shop"}`}
                  className="btn bg-white text-primary-dark hover:bg-cream"
                >
                  {special.cta ?? t("nav.viewAll")}
                </Link>
              </div>
            </div>
            <div className="relative min-h-[300px] lg:min-h-[460px]">
              {special.imageUrl ? (
                <Image src={special.imageUrl} alt={special.title} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* New arrivals */}
      <section className="container-page py-20 md:py-24">
        <SectionHeading
          eyebrow={locale === "th" ? "มาใหม่" : "Just in"}
          title={t("home.newArrivals.title")}
          description={t("home.newArrivals.subtitle")}
          action={
            <Link href={`/${locale}/shop?sort=newest`} className="group inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary-dark">
              {t("nav.viewAll")}
              <IconArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          }
        />
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 md:grid-cols-4">
          {newArrivals.items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              locale={locale}
              inWishlist={wishlistIds.includes(product.id)}
              returnTo={`/${locale}`}
            />
          ))}
        </div>
      </section>

      {/* Occasions */}
      <section className="border-y border-line bg-ivory">
        <div className="container-page py-20 md:py-24">
          <SectionHeading
            eyebrow={locale === "th" ? "ทุกโอกาส" : "Every occasion"}
            title={t("home.occasions.title")}
            description={t("home.occasions.subtitle")}
            action={
              <Link href={`/${locale}/flower-finder`} className="group inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary-dark">
                <IconCalendar size={16} />
                {t("finder.title")}
                <IconArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </Link>
            }
          />
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {occasionIcons.map((occasion) => (
              <Link
                key={occasion.slug}
                href={`/${locale}/occasion/${occasion.slug}`}
                className="group relative aspect-[4/5] overflow-hidden bg-[#efece3] sm:aspect-[3/4]"
              >
                {occasion.imageUrl ? (
                  <Image
                    src={occasion.imageUrl}
                    alt={occasion.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-cover transition-transform duration-[900ms] group-hover:scale-[1.05]"
                  />
                ) : null}
                <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3.5">
                  <span className="font-serif text-[15px] leading-tight text-white sm:text-base">{occasion.name}</span>
                  <IconArrowRight size={15} className="shrink-0 text-white/85 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      {reviews.length > 0 ? (
        <section className="container-page py-20 md:py-24">
          <SectionHeading eyebrow={locale === "th" ? "รีวิวที่ผ่านการยืนยัน" : "Verified reviews"} title={t("home.reviews.title")} description={t("home.reviews.subtitle")} align="center" />
          {reviewAggregate.count > 0 ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <RatingStars value={reviewAggregate.average} size={17} />
              <span className="text-sm text-charcoal">
                {reviewAggregate.average} / 5 · {reviewAggregate.count}{" "}
                {locale === "th" ? "รีวิวจากผู้ซื้อจริง" : "verified reviews"}
              </span>
            </div>
          ) : null}
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {reviews.slice(0, 3).map((review) => (
              <figure key={review.id} className="flex h-full flex-col justify-between border border-line bg-white p-6">
                <div>
                  <RatingStars value={review.rating} />
                  <blockquote className="mt-4 font-serif text-[17px] leading-relaxed text-charcoal">
                    “{review.body}”
                  </blockquote>
                </div>
                <figcaption className="mt-6 border-t border-line pt-4 text-xs text-muted">
                  <span>{review.authorName}</span>
                  <span className="mx-2">·</span>
                  <span>{review.productName}</span>
                  <span className="mx-2">·</span>
                  <span>{formatDate(review.createdAt, locale, { dateStyle: "medium" })}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* Social gallery */}
      {gallery.length > 0 ? (
        <section className="border-t border-line bg-white">
          <div className="container-page py-16">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="eyebrow">{t("home.social.title")}</p>
              <a
                href={`https://instagram.com/${settings.store.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-serif text-xl hover:text-primary-dark"
              >
                <IconInstagram size={20} />
                {t("home.social.follow")}
              </a>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-2 md:grid-cols-6">
              {gallery.slice(0, 6).map((image) => (
                <a
                  key={image.id}
                  href={image.link_url ?? `https://instagram.com/${settings.store.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-square overflow-hidden bg-[#f1efe8]"
                >
                  <Image
                    src={image.image_url}
                    alt={image.caption ?? "BLOOMÉ studio"}
                    fill
                    sizes="(max-width: 768px) 33vw, 16vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Newsletter */}
      <section className="container-page py-16 md:py-20">
        <div className="mx-auto max-w-4xl border border-line bg-white px-6 py-12 text-center sm:px-14 sm:py-14">
          <p className="eyebrow">{locale === "th" ? "จดหมายจากสตูดิโอ" : "Letters from the studio"}</p>
          <h2 className="mt-4 text-[26px] leading-tight sm:text-[34px]">{t("home.newsletter.title")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">{t("home.newsletter.subtitle")}</p>
          <div className="mx-auto mt-8 max-w-xl text-left">
            <NewsletterForm tone="light" />
          </div>
          <p className="mt-5 text-[11px] text-muted">
            {locale === "th"
              ? "ไม่ส่งสแปม · ยกเลิกได้ทุกเมื่อ · เก็บข้อมูลตามนโยบายความเป็นส่วนตัว"
              : "No spam · unsubscribe anytime · handled under our privacy policy"}
          </p>
        </div>
      </section>
    </div>
  );
}
