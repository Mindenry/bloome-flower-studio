import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContentPage } from "@/lib/content";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/time";

const KNOWN = ["privacy-policy", "terms", "shipping-policy", "returns", "cookie-policy"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : "th";
  const page = await getContentPage(slug, locale);
  return {
    title: page?.metaTitle ?? page?.title ?? slug,
    description: page?.metaDescription ?? undefined,
    alternates: { canonical: `/${locale}/policies/${slug}` },
  };
}

export function generateStaticParams() {
  return KNOWN.flatMap((slug) => [{ locale: "th", slug }, { locale: "en", slug }]);
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const page = await getContentPage(slug, locale);
  if (!page) notFound();

  return (
    <div className="container-page py-12 md:py-16">
      <article className="mx-auto max-w-3xl">
        <p className="eyebrow">
          {locale === "th" ? "นโยบาย" : "Policies"} · {formatDate(new Date(), locale, { dateStyle: "long" })}
        </p>
        <h1 className="mt-3 text-[30px] leading-tight sm:text-[38px]">{page.title}</h1>
        <div className="prose-editorial mt-8">
          {page.body.split("\n\n").map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
