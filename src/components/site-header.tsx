import { getCurrentUser, isStaff } from "@/lib/auth/session";
import { getCartBadgeCount, getWishlistIds } from "@/lib/cart";
import { getActiveBanners, getNavData } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import type { Locale } from "@/lib/i18n/config";
import { AnnouncementBar } from "./announcement-bar";
import { SiteHeaderClient } from "./site-header-client";

export async function SiteHeader({ locale }: { locale: Locale }) {
  const user = await getCurrentUser();
  const [settings, cartCount, wishlistIds, nav, announcements] = await Promise.all([
    getSettings(),
    getCartBadgeCount(),
    getWishlistIds(user?.id ?? null),
    getNavData(locale),
    getActiveBanners("announcement", locale),
  ]);

  return (
    <>
      <AnnouncementBar
        items={announcements.map((item) => ({
          id: item.id,
          text: item.title,
          href: item.linkUrl ? (item.linkUrl.startsWith("http") ? item.linkUrl : `/${locale}${item.linkUrl}`) : null,
        }))}
      />
      <SiteHeaderClient
        locale={locale}
        brand={locale === "th" ? settings.store.name : settings.store.nameEn}
        phone={settings.store.phone}
        nav={nav}
        user={user ? { name: user.name, isStaff: isStaff(user) } : null}
        cartCount={cartCount}
        wishlistCount={wishlistIds.length}
      />
    </>
  );
}
