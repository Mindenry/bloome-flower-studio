import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/components/i18n-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { htmlLang, isLocale, locales, ogLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import "../globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F7F5EF",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "th";
  const settings = await getSettings();
  const title = locale === "th" ? settings.seo.titleTh : settings.seo.titleEn;
  const description = locale === "th" ? settings.seo.descriptionTh : settings.seo.descriptionEn;
  const base = env.appUrl;

  return {
    metadataBase: new URL(base),
    title: {
      default: title,
      template: `%s | ${settings.store.nameEn.replace(" FLOWER STUDIO", "")}`,
    },
    description,
    keywords: settings.seo.keywords,
    applicationName: settings.store.nameEn,
    alternates: {
      canonical: `${base}/${locale}`,
      languages: {
        th: `${base}/th`,
        en: `${base}/en`,
        "x-default": `${base}/th`,
      },
    },
    openGraph: {
      type: "website",
      siteName: settings.store.nameEn,
      title,
      description,
      locale: ogLocale[locale],
      alternateLocale: [ogLocale[locale === "th" ? "en" : "th"]],
      images: [{ url: settings.seo.ogImage || "/images/og-default.jpg", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [settings.seo.ogImage || "/images/og-default.jpg"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large" },
    },
    icons: {
      icon: settings.store.faviconUrl || "/favicon.svg",
    },
    formatDetection: { telephone: true, email: true, address: true },
  };
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const settings = await getSettings();

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Florist",
    name: settings.store.nameEn,
    alternateName: settings.store.name,
    description: translate(locale, "seo.home.description"),
    url: env.appUrl,
    telephone: settings.store.phone,
    email: settings.store.email,
    image: `${env.appUrl}/images/og-default.jpg`,
    priceRange: "฿฿",
    currenciesAccepted: "THB",
    paymentAccepted: "PromptPay, Credit Card, Bank Transfer",
    address: {
      "@type": "PostalAddress",
      streetAddress: locale === "th" ? settings.store.addressTh : settings.store.addressEn,
      addressLocality: "Bangkok",
      addressCountry: "TH",
    },
    openingHours: "Mo-Su 09:00-19:00",
    sameAs: [
      `https://instagram.com/${settings.store.instagram}`,
      `https://facebook.com/${settings.store.facebook}`,
    ].filter((url) => !url.endsWith("/")),
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.store.nameEn,
    url: env.appUrl,
    inLanguage: ["th", "en"],
    potentialAction: {
      "@type": "SearchAction",
      target: `${env.appUrl}/${locale}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang={htmlLang[locale]} data-font={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=Prompt:wght@300;400;500;600&family=Noto+Sans+Thai:wght@300;400;500;600&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:text-sm"
        >
          {locale === "th" ? "ข้ามไปยังเนื้อหาหลัก" : "Skip to content"}
        </a>
        <I18nProvider locale={locale}>
          {children}
          <CookieConsent />
        </I18nProvider>
      </body>
    </html>
  );
}
