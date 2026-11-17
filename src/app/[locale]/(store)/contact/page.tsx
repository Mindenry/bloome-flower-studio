import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { getContentPage } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { IconMail, IconPhone, IconPin, IconClock } from "@/components/icons";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "th";
  const page = await getContentPage("contact", locale);
  return {
    title: page?.metaTitle ?? translate(locale, "contact.title"),
    description: page?.metaDescription ?? translate(locale, "contact.subtitle"),
    alternates: { canonical: `/${locale}/contact` },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const [page, settings] = await Promise.all([getContentPage("contact", locale), getSettings()]);

  return (
    <div className="container-page py-12 md:py-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="eyebrow">{t("nav.contact")}</p>
          <h1 className="mt-3 text-[32px] leading-tight sm:text-[40px]">{page?.title ?? t("contact.title")}</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{page?.body ? page.body.split("\n\n")[0] : t("contact.subtitle")}</p>

          <dl className="mt-8 space-y-5 border-t border-line pt-8 text-sm">
            <div className="flex gap-3">
              <IconPin size={18} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("contact.address")}</dt>
                <dd className="mt-1">{locale === "th" ? settings.store.addressTh : settings.store.addressEn}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <IconPhone size={18} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("checkout.phone")}</dt>
                <dd className="mt-1">
                  <a href={`tel:${settings.store.phone.replace(/[^0-9+]/g, "")}`} className="hover:text-primary-dark">
                    {settings.store.phone}
                  </a>
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <IconMail size={18} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("auth.email")}</dt>
                <dd className="mt-1">
                  <a href={`mailto:${settings.store.email}`} className="hover:text-primary-dark">
                    {settings.store.email}
                  </a>
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <IconClock size={18} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("contact.hours")}</dt>
                <dd className="mt-1">{locale === "th" ? settings.store.hoursTh : settings.store.hoursEn}</dd>
              </div>
            </div>
          </dl>

          <p className="mt-8 text-xs text-muted">
            LINE: <span className="text-charcoal">{settings.store.lineId}</span> · Instagram:{" "}
            <a href={`https://instagram.com/${settings.store.instagram}`} className="underline underline-offset-2 hover:text-primary-dark">
              @{settings.store.instagram}
            </a>
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <h2 className="text-xl">{t("contact.send")}</h2>
          <p className="mt-1 text-xs text-muted">{t("contact.sent")}</p>
          <div className="mt-6">
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
