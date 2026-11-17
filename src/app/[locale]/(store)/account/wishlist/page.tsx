import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/ui";
import { IconHeart } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth/session";
import { getWishlistIds } from "@/lib/cart";
import { listProductsByIds } from "@/lib/catalog";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountWishlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const ids = await getWishlistIds(user.id);
  const products = await listProductsByIds(locale, ids);

  return (
    <div>
      <h2 className="text-xl">{t("account.wishlist")}</h2>
      {products.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={t("account.wishlist")}
            description={t("shop.emptyHint")}
            icon={<IconHeart size={28} />}
            action={
              <Link href={`/${locale}/shop`} className="btn btn-primary btn-sm">
                {t("nav.shop")}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              locale={locale}
              inWishlist
              returnTo={`/${locale}/account/wishlist`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
