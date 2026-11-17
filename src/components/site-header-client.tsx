"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { localeShort, localeNames, otherLocale, swapLocalePath, type Locale } from "@/lib/i18n/config";
import { useI18n } from "./i18n-provider";
import { SearchOverlay } from "./search-overlay";
import { logoutAction } from "@/app/actions/auth";
import type { NavItem } from "@/lib/content";
import {
  IconBag,
  IconChevronDown,
  IconChevronRight,
  IconClose,
  IconHeart,
  IconMenu,
  IconSearch,
  IconSparkle,
  IconUser,
} from "./icons";

type Props = {
  locale: Locale;
  brand: string;
  phone: string;
  nav: { categories: NavItem[]; collections: NavItem[]; occasions: NavItem[] };
  user: { name: string; isStaff: boolean } | null;
  cartCount: number;
  wishlistCount: number;
};

type MenuKey = "collections" | "occasions" | null;

export function SiteHeaderClient({ locale, brand, phone, nav, user, cartCount, wishlistCount }: Props) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
    setLangOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen || searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen, searchOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setOpenMenu(null);
        setLangOpen(false);
        setAccountOpen(false);
        setMobileOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const other = otherLocale(locale);
  const currentSection = pathname.split("/")[2] ?? "";
  const isActive = (key: string) =>
    key === "home" ? currentSection === "" : currentSection === key || currentSection.startsWith(key);
  const brandWord = brand.replace(" FLOWER STUDIO", "");
  const initial = user?.name?.trim()?.charAt(0)?.toUpperCase() ?? "";

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
        setLangOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener("click", onClickAway);
    return () => document.removeEventListener("click", onClickAway);
  }, []);

  const openWithIntent = (menu: MenuKey) => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenMenu(menu);
  };
  const closeWithIntent = () => {
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 140);
  };

  const navLinks = [
    { href: `/${locale}/shop`, label: t("nav.shop"), key: "shop" },
    { href: `/${locale}/shop?sort=newest`, label: t("nav.collections"), key: "collections", menu: "collections" as const },
    { href: `/${locale}/shop`, label: t("nav.occasions"), key: "occasions", menu: "occasions" as const },
    { href: `/${locale}/blog`, label: t("nav.blog"), key: "blog", tight: true },
    { href: `/${locale}/about`, label: t("nav.about"), key: "about", tight: true },
  ];

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 ${
        scrolled
          ? "border-line/90 bg-cream/90 shadow-[0_10px_40px_-28px_rgba(41,42,39,0.45)] backdrop-blur-xl"
          : "border-transparent bg-cream"
      }`}
      onMouseLeave={closeWithIntent}
    >
      <div className="container-page">
        <div
          className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 transition-[height] duration-500 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6 ${
            scrolled ? "h-[62px] lg:h-[70px]" : "h-[68px] lg:h-[92px]"
          }`}
        >
          {/* Mobile menu trigger */}
          <div className="flex items-center gap-1 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t("nav.menu")}
              aria-expanded={mobileOpen}
              className="-ml-2 flex h-11 w-11 items-center justify-center text-charcoal transition-colors hover:text-primary-dark"
            >
              <IconMenu size={22} />
            </button>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden min-w-0 items-center gap-1 lg:flex" aria-label="Main">
            {navLinks.map((link) => {
              const active = isActive(link.key);
              return (
                <div
                  key={link.label}
                  className={`relative ${link.tight ? "hidden xl:block" : ""}`}
                  onMouseEnter={() => link.menu && openWithIntent(link.menu)}
                >
                  {link.menu ? (
                    <button
                      type="button"
                      aria-expanded={openMenu === link.menu}
                      aria-haspopup="true"
                      onClick={() => setOpenMenu(openMenu === link.menu ? null : link.menu)}
                      className={`group relative flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[12px] uppercase tracking-[0.1em] transition-colors xl:px-4 ${
                        openMenu === link.menu || active ? "text-primary-dark" : "text-charcoal/80 hover:text-primary-dark"
                      }`}
                    >
                      {link.label}
                      <IconChevronDown
                        size={13}
                        className={`transition-transform duration-300 ${openMenu === link.menu ? "rotate-180" : ""}`}
                      />
                      <span
                        className={`absolute inset-x-3 -bottom-0.5 h-px origin-left bg-primary-dark transition-transform duration-300 xl:inset-x-4 ${
                          active || openMenu === link.menu ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                        }`}
                      />
                    </button>
                  ) : (
                    <Link
                      href={link.href}
                      className={`group relative flex items-center whitespace-nowrap px-3 py-2 text-[12px] uppercase tracking-[0.1em] transition-colors xl:px-4 ${
                        active ? "text-primary-dark" : "text-charcoal/80 hover:text-primary-dark"
                      }`}
                    >
                      {link.label}
                      <span
                        className={`absolute inset-x-3 -bottom-0.5 h-px origin-left bg-primary-dark transition-transform duration-300 xl:inset-x-4 ${
                          active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                        }`}
                      />
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Wordmark */}
          <Link
            href={`/${locale}`}
            className="group flex flex-col items-center justify-center px-3 text-center lg:px-8"
            aria-label={brand}
          >
            <span
              className={`whitespace-nowrap font-serif leading-none tracking-[0.22em] transition-all duration-500 ${
                scrolled ? "text-[19px] lg:text-[21px]" : "text-[20px] sm:text-[23px] lg:text-[26px]"
              }`}
            >
              {brandWord}
            </span>
            <span
              className={`mt-1.5 h-px bg-primary/50 transition-all duration-500 ${
                scrolled ? "w-6" : "w-10 group-hover:w-16"
              }`}
              aria-hidden="true"
            />
            <span className="mt-1.5 hidden text-[7.5px] uppercase tracking-[0.34em] text-muted lg:block">
              Bangkok · Est. 2017
            </span>
          </Link>

          {/* Actions */}
          <div className="flex items-center justify-end gap-0.5 justify-self-end sm:gap-1" aria-label="Account">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={t("nav.search")}
              className="group hidden h-9 items-center gap-2 border border-line bg-white/55 px-2.5 text-[11px] text-muted transition-colors hover:border-primary/60 hover:bg-white hover:text-charcoal xl:flex"
            >
              <IconSearch size={16} />
              <span>{t("nav.search")}</span>
              <kbd className="ml-1 border border-line bg-white/80 px-1 py-0.5 text-[9px] tracking-normal text-muted">⌘K</kbd>
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={t("nav.search")}
              className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-white/80 hover:text-primary-dark xl:hidden"
            >
              <IconSearch size={19} />
            </button>

            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => {
                  setLangOpen(!langOpen);
                  setAccountOpen(false);
                }}
                aria-expanded={langOpen}
                aria-label={t("common.language")}
                className="flex h-11 items-center gap-1 rounded-full px-2.5 text-[11px] uppercase tracking-[0.12em] text-charcoal transition-colors hover:bg-white/80 hover:text-primary-dark"
              >
                {localeShort[locale]}
                <IconChevronDown size={12} className={`transition-transform ${langOpen ? "rotate-180" : ""}`} />
              </button>
              {langOpen ? (
                <div className="absolute right-0 top-full z-50 mt-2 w-44 animate-[menu-in_0.22s_ease] border border-line bg-white py-1.5 shadow-[0_20px_50px_-30px_rgba(41,42,39,0.4)]">
                  {(["th", "en"] as Locale[]).map((code) => (
                    <Link
                      key={code}
                      href={swapLocalePath(pathname, code)}
                      hrefLang={code}
                      className={`flex items-center justify-between px-4 py-2.5 text-xs transition-colors hover:bg-cream ${
                        code === locale ? "text-primary-dark" : "text-charcoal"
                      }`}
                    >
                      {localeNames[code]}
                      {code === locale ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <span className="mx-0.5 hidden h-4 w-px bg-line sm:block" aria-hidden="true" />
            {user ? (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => {
                    setAccountOpen(!accountOpen);
                    setLangOpen(false);
                  }}
                  aria-expanded={accountOpen}
                  aria-label={t("nav.account")}
                  className="flex h-11 items-center gap-2 rounded-full px-1.5 transition-colors hover:bg-white/80"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white font-serif text-[12px] text-primary-dark">
                    {initial}
                  </span>
                  <IconChevronDown size={12} className={`text-muted transition-transform ${accountOpen ? "rotate-180" : ""}`} />
                </button>
                {accountOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-[menu-in_0.22s_ease] border border-line bg-white py-1.5 shadow-[0_20px_50px_-30px_rgba(41,42,39,0.4)]">
                    <p className="truncate px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-muted">{user.name}</p>
                    {[
                      { href: `/${locale}/account`, label: t("account.dashboard") },
                      { href: `/${locale}/account/orders`, label: t("account.orders") },
                      { href: `/${locale}/account/wishlist`, label: t("account.wishlist") },
                      { href: `/${locale}/account/notifications`, label: t("account.notifications") },
                    ].map((item) => (
                      <Link key={item.href} href={item.href} className="block px-4 py-2 text-xs text-charcoal hover:bg-cream">
                        {item.label}
                      </Link>
                    ))}
                    {user.isStaff ? (
                      <Link href={`/${locale}/admin`} className="block border-t border-line px-4 py-2 text-xs text-primary-dark hover:bg-cream">
                        {t("nav.admin")}
                      </Link>
                    ) : null}
                    <form action={logoutAction} className="border-t border-line">
                      <input type="hidden" name="locale" value={locale} />
                      <button type="submit" className="w-full px-4 py-2 text-left text-xs text-muted hover:bg-cream hover:text-danger">
                        {t("nav.logout")}
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link
                href={`/${locale}/login`}
                aria-label={t("nav.login")}
                className="hidden h-11 w-11 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-white/80 hover:text-primary-dark sm:flex"
              >
                <IconUser size={19} />
              </Link>
            )}

            <Link
              href={`/${locale}/wishlist`}
              aria-label={t("nav.wishlist")}
              className="relative hidden h-11 w-11 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-white/80 hover:text-primary-dark sm:flex"
            >
              <IconHeart size={19} />
              {wishlistCount > 0 ? (
                <span className="absolute right-1 top-1.5 flex h-4 min-w-4 items-center justify-center bg-dusty px-1 text-[9px] leading-none text-charcoal">
                  {wishlistCount}
                </span>
              ) : null}
            </Link>

            <Link
              href={`/${locale}/cart`}
              aria-label={t("nav.cart")}
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-charcoal transition-colors hover:bg-white/80 hover:text-primary-dark"
            >
              <IconBag size={20} />
              {cartCount > 0 ? (
                <span
                  aria-live="polite"
                  className="absolute right-0.5 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-medium leading-none text-white"
                >
                  {cartCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>
      </div>

      {/* Mega menu */}
      {openMenu ? (
        <div
          className="absolute inset-x-0 top-full hidden animate-[menu-in_0.24s_cubic-bezier(0.22,1,0.36,1)] border-y border-line bg-cream/97 shadow-[0_40px_80px_-50px_rgba(41,42,39,0.5)] backdrop-blur-xl lg:block"
          onMouseEnter={() => openWithIntent(openMenu)}
          onMouseLeave={closeWithIntent}
        >
          <div className="container-page grid gap-10 py-9 xl:grid-cols-[0.85fr_1.9fr_1fr]">
            <div>
              <p className="eyebrow mb-4">{openMenu === "occasions" ? t("nav.occasions") : t("nav.collections")}</p>
              <ul className="space-y-1">
                {(openMenu === "occasions" ? nav.occasions : nav.collections).slice(0, 7).map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={`/${locale}/${openMenu === "occasions" ? "occasion" : "category"}/${item.slug}`}
                      onClick={() => setOpenMenu(null)}
                      className="group flex items-center justify-between border-b border-line/70 py-2.5 text-[13px] transition-colors hover:text-primary-dark"
                    >
                      <span>{item.name}</span>
                      <IconChevronRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/${locale}/shop`}
                onClick={() => setOpenMenu(null)}
                className="mt-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-primary-dark"
              >
                {t("nav.allFlowers")}
                <IconChevronRight size={13} />
              </Link>
            </div>

            <div>
              <p className="eyebrow mb-4">{openMenu === "occasions" ? t("home.occasions.title") : t("nav.allFlowers")}</p>
              <div className="grid grid-cols-3 gap-x-5 gap-y-4 xl:grid-cols-4">
                {(openMenu === "occasions" ? nav.occasions : nav.categories).map((item) => (
                  <Link
                    key={item.slug}
                    href={`/${locale}/${openMenu === "occasions" ? "occasion" : "category"}/${item.slug}`}
                    onClick={() => setOpenMenu(null)}
                    className="group block"
                  >
                    <span className="relative block aspect-[4/3] overflow-hidden bg-[#efece3]">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                        />
                      ) : null}
                    </span>
                    <span className="mt-2 block text-[12px] leading-5 transition-colors group-hover:text-primary-dark">
                      {item.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="border-l border-line pl-8">
              <div className="relative aspect-[4/5] overflow-hidden bg-[#efece3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    (openMenu === "occasions" ? nav.occasions[0]?.imageUrl : nav.collections[0]?.imageUrl) ??
                    "/uploads/seed/pexels/florist-08.webp"
                  }
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-[9px] uppercase tracking-[0.24em] text-white/70">
                    {locale === "th" ? "บริการช่วยเลือก" : "Personal shopping"}
                  </p>
                  <p className="mt-1 font-serif text-lg leading-snug">
                    {locale === "th" ? "ปรึกษานักจัดดอกไม้ของเรา" : "Talk to our florist"}
                  </p>
                  <Link
                    href={`/${locale}/contact`}
                    onClick={() => setOpenMenu(null)}
                    className="mt-3 inline-flex items-center gap-1.5 border-b border-white/60 pb-0.5 text-[10px] uppercase tracking-[0.16em]"
                  >
                    {phone}
                    <IconSparkle size={12} />
                  </Link>
                </div>
              </div>
              <Link
                href={`/${locale}/flower-finder`}
                onClick={() => setOpenMenu(null)}
                className="mt-4 flex items-center justify-between border border-line bg-white px-4 py-3 text-[11px] transition-colors hover:border-primary"
              >
                <span>{t("finder.title")}</span>
                <IconChevronRight size={14} className="text-muted" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("nav.menu")}>
          <button type="button" aria-label={t("common.close")} className="absolute inset-0 bg-charcoal/45 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[92%] max-w-md animate-[drawer-in_0.4s_cubic-bezier(0.22,1,0.36,1)] flex-col overflow-y-auto bg-cream">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-cream/95 px-5 py-4 backdrop-blur">
              <span className="font-serif text-lg tracking-[0.22em]">{brandWord}</span>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label={t("common.close")} className="flex h-10 w-10 items-center justify-center">
                <IconClose size={22} />
              </button>
            </div>

            <div className="px-5 py-6">
              <nav aria-label="Mobile" className="space-y-1">
                {[
                  { href: `/${locale}/shop`, label: t("nav.shop") },
                  { href: `/${locale}/shop?sort=newest`, label: t("nav.collections") },
                  { href: `/${locale}/shop`, label: t("nav.occasions") },
                  { href: `/${locale}/blog`, label: t("nav.blog") },
                  { href: `/${locale}/about`, label: t("nav.about") },
                  { href: `/${locale}/contact`, label: t("nav.contact") },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between border-b border-line py-3.5 font-serif text-[22px] leading-none transition-colors hover:text-primary-dark"
                  >
                    {item.label}
                    <IconChevronRight size={18} className="text-muted" />
                  </Link>
                ))}
              </nav>

              <div className="mt-7">
                <p className="eyebrow">{t("nav.categories")}</p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {nav.categories.slice(0, 8).map((item) => (
                    <Link key={item.slug} href={`/${locale}/category/${item.slug}`} className="block">
                      <span className="relative block aspect-square overflow-hidden bg-[#efece3]">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : null}
                      </span>
                      <span className="mt-1.5 block truncate text-[10px] leading-4 text-muted">{item.name}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-7">
                <p className="eyebrow">{t("nav.occasions")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {nav.occasions.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/${locale}/occasion/${item.slug}`}
                      className="border border-line bg-white px-3 py-1.5 text-[11px] transition-colors hover:border-primary"
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-2 border-t border-line pt-5 text-[11px]">
                {[
                  { href: `/${locale}/flower-finder`, label: t("finder.title") },
                  { href: `/${locale}/order/track`, label: t("order.track.title") },
                  { href: `/${locale}/care-guide`, label: t("nav.care") },
                  { href: `/${locale}/faq`, label: t("nav.faq") },
                ].map((item) => (
                  <Link key={item.href} href={item.href} className="border border-line bg-white px-3 py-2.5 text-center">
                    {item.label}
                  </Link>
                ))}
              </div>

              <div className="mt-6 flex gap-2">
                {user ? (
                  <>
                    <Link href={`/${locale}/account`} className="btn btn-outline flex-1">
                      {t("nav.account")}
                    </Link>
                    {user.isStaff ? (
                      <Link href={`/${locale}/admin`} className="btn btn-primary flex-1">
                        {t("nav.admin")}
                      </Link>
                    ) : null}
                  </>
                ) : (
                  <Link href={`/${locale}/login`} className="btn btn-primary flex-1">
                    {t("nav.login")}
                  </Link>
                )}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-line pt-5 text-[11px] text-muted">
                <div className="flex gap-3">
                  <Link href={swapLocalePath(pathname, other)} hrefLang={other} className={other === locale ? "" : "underline underline-offset-4"}>
                    {localeNames[other]}
                  </Link>
                  <span aria-hidden="true">·</span>
                  <span className="text-charcoal">{localeNames[locale]}</span>
                </div>
                <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="text-primary-dark">
                  {phone}
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {searchOpen ? <SearchOverlay onClose={() => setSearchOpen(false)} /> : null}
    </header>
  );
}
