"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { useI18n } from "./i18n-provider";
import {
  IconCalendar,
  IconGift,
  IconGrid,
  IconHeart,
  IconHome,
  IconLock,
  IconPackage,
  IconPin,
  IconUser,
} from "./icons";

export function AccountNav({
  locale,
  unreadCount,
  userName,
}: {
  locale: string;
  unreadCount: number;
  userName: string;
}) {
  const { t } = useI18n();
  const pathname = usePathname();

  const items = [
    { href: `/${locale}/account`, label: t("account.dashboard"), icon: IconGrid, exact: true },
    { href: `/${locale}/account/orders`, label: t("account.orders"), icon: IconPackage },
    { href: `/${locale}/account/wishlist`, label: t("account.wishlist"), icon: IconHeart },
    { href: `/${locale}/account/addresses`, label: t("account.addresses"), icon: IconPin },
    { href: `/${locale}/account/recipients`, label: t("account.recipients"), icon: IconGift },
    { href: `/${locale}/account/reminders`, label: t("account.reminders"), icon: IconCalendar },
    { href: `/${locale}/account/notifications`, label: t("account.notifications"), icon: IconHome, badge: unreadCount },
    { href: `/${locale}/account/profile`, label: t("account.profile"), icon: IconUser },
    { href: `/${locale}/account/security`, label: t("account.security"), icon: IconLock },
  ];

  return (
    <nav aria-label={t("account.title")} className="lg:sticky lg:top-28">
      <div className="border border-line bg-white">
        <div className="border-b border-line px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted">{t("account.title")}</p>
          <p className="mt-1 truncate font-serif text-lg">{userName}</p>
        </div>
        <ul className="p-2">
          {items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                    active ? "bg-primary-soft text-primary-dark" : "text-charcoal hover:bg-cream"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon size={16} className={active ? "text-primary-dark" : "text-muted"} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="flex h-5 min-w-5 items-center justify-center bg-dusty px-1 text-[10px] text-charcoal">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <form action={logoutAction} className="border-t border-line p-2">
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="w-full px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-cream hover:text-danger"
          >
            {t("nav.logout")}
          </button>
        </form>
      </div>
    </nav>
  );
}
