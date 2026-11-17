import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/ui";
import { IconHeart } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth/session";
import { getWishlistIds } from "@/lib/cart";
import { listProductsByIds } from "@/lib/catalog";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function WishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title={t("nav.wishlist")}
          description={locale === "th" ? "เข้าสู่ระบบเพื่อบันทึกรายการโปรดของคุณ" : "Sign in to keep your favourite arrangements."}
          icon={<IconHeart size={30} />}
          action={
            <Link href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/wishlist`)}`} className="btn btn-primary">
              {t("nav.login")}
            </Link>
          }
        />
      </div>
    );
  }

  const ids = await getWishlistIds(user.id);
  const products = await listProductsByIds(locale, ids);

  return (
    <div className="container-page py-10 md:py-14">
      <p className="eyebrow">{t("nav.wishlist")}</p>
      <h1 className="mt-2 text-[30px]">{t("account.wishlist")}</h1>
      {products.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={t("account.wishlist")}
            description={t("shop.emptyHint")}
            icon={<IconHeart size={26} />}
            action={
              <Link href={`/${locale}/shop`} className="btn btn-primary btn-sm">
                {t("nav.shop")}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} inWishlist returnTo={`/${locale}/wishlist`} />
          ))}
        </div>
      )}
    </div>
  );
}
