import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContentPage, getGallery } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { SectionHeading } from "@/components/ui";
import { IconArrowRight, IconLeaf, IconPen, IconTruck } from "@/components/icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "th";
  const page = await getContentPage("about", locale);
  return {
    title: page?.metaTitle ?? page?.title ?? translate(locale, "brand.about"),
    description: page?.metaDescription ?? undefined,
    alternates: { canonical: `/${locale}/about` },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const [page, settings, gallery] = await Promise.all([getContentPage("about", locale), getSettings(), getGallery()]);

  return (
    <div>
      <section className="container-page grid gap-12 py-14 lg:grid-cols-2 lg:py-20">
        <div className="flex flex-col justify-center">
          <p className="eyebrow">{locale === "th" ? "เกี่ยวกับเรา" : "About us"}</p>
          <h1 className="mt-4 text-[34px] leading-tight sm:text-[44px]">{page?.title ?? t("brand.about")}</h1>
          <div className="prose-editorial mt-6 max-w-xl">
            {(page?.body ?? "").split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/${locale}/shop`} className="btn btn-primary">
              {t("nav.shop")}
            </Link>
            <Link href={`/${locale}/contact`} className="btn btn-ghost">
              {t("nav.contact")}
            </Link>
          </div>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden bg-[#f1efe8]">
          <Image
            src={gallery[0]?.image_url ?? "/uploads/seed/pexels/florist-03.webp"}
            alt={page?.title ?? settings.store.nameEn}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 48vw"
            className="object-cover"
          />
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="container-page grid gap-8 py-14 md:grid-cols-3">
          {[
            {
              icon: IconLeaf,
              title: locale === "th" ? "ดอกไม้จากสวนที่ไว้ใจ" : "Trusted growers",
              body:
                locale === "th"
                  ? "เราทำงานร่วมกับสวนในเชียงใหม่ ปทุมธานี และราชบุรี เลือกดอกไม้ในเช้าของวันส่งมอบ"
                  : "We work with farms in Chiang Mai, Pathum Thani and Ratchaburi, selecting stems on the morning of delivery.",
            },
            {
              icon: IconPen,
              title: locale === "th" ? "จัดด้วยมือทุกช่อ" : "Every stem by hand",
              body:
                locale === "th"
                  ? "นักจัดดอกไม้ของเราออกแบบและจัดทุกช่อในสตูดิโอ ไม่มีการจัดสำเร็จรูปจากโรงงาน"
                  : "Our florists design and arrange every bouquet in the studio — never pre-made.",
            },
            {
              icon: IconTruck,
              title: locale === "th" ? "ส่งด้วยทีมของเราเอง" : "Delivered by our team",
              body:
                locale === "th"
                  ? "ทีมจัดส่งของเราดูแลทุกคำสั่งซื้อในกรุงเทพฯ พร้อมแจ้งเตือนผู้รับก่อนถึงเวลา"
                  : "Our own couriers handle every Bangkok order, with a notification before arrival.",
            },
          ].map((value) => (
            <div key={value.title}>
              <value.icon size={24} className="text-primary" />
              <h2 className="mt-4 font-serif text-xl">{value.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{value.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-16">
        <SectionHeading
          eyebrow={locale === "th" ? "สตูดิโอของเรา" : "The studio"}
          title={locale === "th" ? "เชิญแวะชมสตูดิโอ" : "Visit the studio"}
          description={locale === "th" ? settings.store.addressTh : settings.store.addressEn}
          action={
            <Link href={`/${locale}/contact`} className="group inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary-dark">
              {t("nav.contact")}
              <IconArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          }
        />
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {gallery.slice(0, 4).map((image) => (
            <div key={image.id} className="relative aspect-square overflow-hidden bg-[#f1efe8]">
              <Image src={image.image_url} alt={image.caption ?? ""} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
