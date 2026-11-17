import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlowerFinder } from "@/components/flower-finder";
import { getNavData } from "@/lib/content";
import { getFilterFacets } from "@/lib/catalog";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "th";
  return {
    title: translate(locale, "finder.title"),
    description: translate(locale, "finder.subtitle"),
    alternates: { canonical: `/${locale}/flower-finder` },
  };
}

export default async function FlowerFinderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const [nav, facets] = await Promise.all([getNavData(locale), getFilterFacets(locale)]);

  return (
    <div className="container-page py-12 md:py-16">
      <p className="eyebrow text-center">{t("finder.title")}</p>
      <h1 className="mt-3 text-center text-[32px] leading-tight sm:text-[40px]">{t("finder.title")}</h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted">{t("finder.subtitle")}</p>
      <div className="mt-12">
        <FlowerFinder
          occasions={nav.occasions.map((occasion) => ({ slug: occasion.slug, name: occasion.name }))}
          colors={facets.colors}
          flowerTypes={facets.flowerTypes}
        />
      </div>
    </div>
  );
}
