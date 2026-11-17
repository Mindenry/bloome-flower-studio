import Link from "next/link";
import { getNavData } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { translate } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { NewsletterForm } from "./newsletter-form";
import { IconFacebook, IconInstagram, IconLine, IconMail, IconPhone, IconPin } from "./icons";

export async function SiteFooter({ locale }: { locale: Locale }) {
  const [settings, nav] = await Promise.all([getSettings(), getNavData(locale)]);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const year = new Date().getFullYear();
  const legal = [
    { href: `/${locale}/policies/privacy-policy`, label: t("footer.privacy") },
    { href: `/${locale}/policies/terms`, label: t("footer.terms") },
    { href: `/${locale}/policies/shipping-policy`, label: t("footer.shipping") },
    { href: `/${locale}/policies/returns`, label: t("footer.returns") },
    { href: `/${locale}/policies/cookie-policy`, label: t("footer.cookies") },
    { href: `/${locale}/photo-credits`, label: locale === "th" ? "เครดิตภาพ" : "Photo credits" },
  ];

  return (
    <footer className="mt-24 bg-[#F1EFE7]">
      {/* Newsletter band */}
      <section aria-labelledby="footer-newsletter" className="bg-[#2F3A2E] text-white">
        <div className="container-page grid gap-8 py-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:py-16">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
              {locale === "th" ? "จดหมายจากสตูดิโอ" : "Letters from the studio"}
            </p>
            <h2 id="footer-newsletter" className="mt-3 font-serif text-[26px] leading-tight text-white sm:text-[32px]">
              {t("home.newsletter.title")}
            </h2>
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/70">{t("home.newsletter.subtitle")}</p>
          </div>
          <div className="lg:pl-6">
            <NewsletterForm />
          </div>
        </div>
      </section>

      {/* Links */}
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-12">
        <div>
          <Link href={`/${locale}`} className="inline-flex flex-col">
            <span className="font-serif text-[24px] tracking-[0.2em] text-charcoal">
              {settings.store.nameEn.replace(" FLOWER STUDIO", "")}
            </span>
            <span className="mt-1 text-[9px] uppercase tracking-[0.4em] text-muted">Flower Studio</span>
          </Link>
          <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-muted">{settings.store.tagline}</p>

          <div className="mt-6 space-y-2.5 text-[13px] text-muted">
            <p className="flex items-start gap-2.5">
              <IconPin size={16} className="mt-0.5 shrink-0 text-primary" />
              <span className="leading-relaxed">{locale === "th" ? settings.store.addressTh : settings.store.addressEn}</span>
            </p>
            <p className="flex items-center gap-2.5">
              <IconPhone size={16} className="shrink-0 text-primary" />
              <a href={`tel:${settings.store.phone.replace(/[^0-9+]/g, "")}`} className="hover:text-primary-dark">
                {settings.store.phone}
              </a>
            </p>
            <p className="flex items-center gap-2.5">
              <IconMail size={16} className="shrink-0 text-primary" />
              <a href={`mailto:${settings.store.email}`} className="break-all hover:text-primary-dark">
                {settings.store.email}
              </a>
            </p>
          </div>

          <div className="mt-6 flex gap-2">
            {[
              { href: `https://instagram.com/${settings.store.instagram}`, label: "Instagram", icon: IconInstagram },
              { href: `https://facebook.com/${settings.store.facebook}`, label: "Facebook", icon: IconFacebook },
              { href: `https://line.me/R/ti/p/${settings.store.lineId.replace("@", "%40")}`, label: "LINE", icon: IconLine },
            ].map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="flex h-10 w-10 items-center justify-center border border-[#d9d6cc] bg-white/60 text-primary-dark transition-colors hover:border-primary hover:bg-primary hover:text-white"
              >
                <social.icon size={18} />
              </a>
            ))}
          </div>
        </div>

        <nav aria-label={t("footer.shop")}>
          <p className="text-[10px] uppercase tracking-[0.22em] text-charcoal">{t("footer.shop")}</p>
          <ul className="mt-4 space-y-2.5 text-[13px] text-muted">
            <li>
              <Link href={`/${locale}/shop`} className="transition-colors hover:text-primary-dark">
                {t("nav.allFlowers")}
              </Link>
            </li>
            {nav.categories.slice(0, 5).map((item) => (
              <li key={item.slug}>
                <Link href={`/${locale}/category/${item.slug}`} className="transition-colors hover:text-primary-dark">
                  {item.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href={`/${locale}/flower-finder`} className="transition-colors hover:text-primary-dark">
                {t("nav.flowerFinder")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("footer.help")}>
          <p className="text-[10px] uppercase tracking-[0.22em] text-charcoal">{t("footer.help")}</p>
          <ul className="mt-4 space-y-2.5 text-[13px] text-muted">
            <li>
              <Link href={`/${locale}/faq`} className="transition-colors hover:text-primary-dark">
                {t("nav.faq")}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/order/track`} className="transition-colors hover:text-primary-dark">
                {t("order.track.title")}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/care-guide`} className="transition-colors hover:text-primary-dark">
                {t("nav.care")}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/policies/shipping-policy`} className="transition-colors hover:text-primary-dark">
                {t("footer.shipping")}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/contact`} className="transition-colors hover:text-primary-dark">
                {t("nav.contact")}
              </Link>
            </li>
            <li>
              <span className="block pt-1 text-[11px] text-muted">{locale === "th" ? settings.store.hoursTh : settings.store.hoursEn}</span>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("footer.about")}>
          <p className="text-[10px] uppercase tracking-[0.22em] text-charcoal">{t("footer.about")}</p>
          <ul className="mt-4 space-y-2.5 text-[13px] text-muted">
            <li>
              <Link href={`/${locale}/about`} className="transition-colors hover:text-primary-dark">
                {t("brand.about")}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/blog`} className="transition-colors hover:text-primary-dark">
                {t("nav.blog")}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/policies/privacy-policy`} className="transition-colors hover:text-primary-dark">
                {t("footer.privacy")}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/policies/terms`} className="transition-colors hover:text-primary-dark">
                {t("footer.terms")}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/contact`} className="transition-colors hover:text-primary-dark">
                {t("nav.contact")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#ddd9cd]">
        <div className="container-page flex flex-col gap-4 py-6 text-[11px] text-muted lg:flex-row lg:items-center lg:justify-between">
          <p className="no-wrap">
            © {year} {settings.store.nameEn}. {t("footer.rights")}
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legal.map((item) => (
              <li key={item.href} className="no-wrap">
                <Link href={item.href} className="transition-colors hover:text-primary-dark">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap items-center gap-2">
            <span className="no-wrap">{t("footer.payment")}:</span>
            {["PromptPay", "VISA", "Mastercard", "Bank transfer"].map((method) => (
              <span key={method} className="no-wrap border border-[#ddd9cd] bg-white px-2 py-1 text-[10px]">
                {method}
              </span>
            ))}
          </p>
        </div>
      </div>
    </footer>
  );
}
