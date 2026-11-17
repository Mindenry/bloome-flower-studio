import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFaqs } from "@/lib/content";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = { alternates: { canonical: "/faq" } };

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const faqs = await getFaqs(locale);

  const groups = faqs.reduce<Record<string, typeof faqs>>((acc, faq) => {
    const key = faq.category ?? "general";
    acc[key] = acc[key] ?? [];
    acc[key].push(faq);
    return acc;
  }, {});

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div className="container-page py-12 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow text-center">{t("nav.faq")}</p>
        <h1 className="mt-3 text-center text-[32px] sm:text-[40px]">{t("nav.faq")}</h1>
        <p className="mt-3 text-center text-sm text-muted">{t("contact.subtitle")}</p>

        <div className="mt-10 space-y-10">
          {Object.entries(groups).map(([category, items]) => (
            <section key={category}>
              <h2 className="font-serif text-xl">{category === "general" ? (locale === "th" ? "ทั่วไป" : "General") : category}</h2>
              <div className="mt-4 divide-y divide-line border-y border-line">
                {items.map((faq) => (
                  <details key={faq.id} className="group">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 text-sm">
                      {faq.question}
                      <span className="text-muted transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="pb-4 text-sm leading-relaxed text-muted">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-12 border border-line bg-white p-6 text-center">
          <p className="font-serif text-lg">{locale === "th" ? "ยังมีคำถามอื่นอีกไหม?" : "Still have a question?"}</p>
          <Link href={`/${locale}/contact`} className="btn btn-outline btn-sm mt-4">
            {t("nav.contact")}
          </Link>
        </div>
      </div>
    </div>
  );
}
