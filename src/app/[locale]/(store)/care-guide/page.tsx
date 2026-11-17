import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCareGuides } from "@/lib/content";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "th";
  return {
    title: translate(locale, "nav.care"),
    description:
      locale === "th"
        ? "วิธีดูแลดอกไม้สดให้อยู่ได้นานขึ้น จากนักจัดดอกไม้ BLOOMÉ"
        : "How to keep cut flowers fresh for longer, from the BLOOMÉ studio.",
    alternates: { canonical: `/${locale}/care-guide` },
  };
}

export default async function CareGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const guides = await getCareGuides(locale);

  return (
    <div className="container-page py-12 md:py-16">
      <p className="eyebrow text-center">{t("nav.care")}</p>
      <h1 className="mt-3 text-center text-[32px] sm:text-[40px]">{t("nav.care")}</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted">
        {locale === "th"
          ? "เคล็ดลับจากนักจัดดอกไม้ของเรา เพื่อให้ดอกไม้อยู่กับคุณได้นานที่สุด"
          : "Notes from our florists, so your flowers stay beautiful for longer."}
      </p>

      <div className="mt-12 grid gap-8 md:grid-cols-2">
        {guides.map((guide) => (
          <article key={guide.id} className="card overflow-hidden">
            {guide.imageUrl ? (
              <div className="relative aspect-[16/10] bg-[#f1efe8]">
                <Image src={guide.imageUrl} alt={guide.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
              </div>
            ) : null}
            <div className="p-6">
              <h2 className="font-serif text-xl">{guide.title}</h2>
              <div className="prose-editorial mt-3 text-sm">
                {guide.body.split("\n\n").map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-12 border border-line bg-white p-6 text-center">
        <p className="font-serif text-lg">{locale === "th" ? "อยากได้คำแนะนำเฉพาะดอกไม้ของคุณ?" : "Want advice for a specific bouquet?"}</p>
        <Link href={`/${locale}/contact`} className="btn btn-outline btn-sm mt-4">
          {t("nav.contact")}
        </Link>
      </div>
    </div>
  );
}
