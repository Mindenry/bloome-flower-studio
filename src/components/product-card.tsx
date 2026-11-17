import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/lib/i18n/config";
import type { ProductCard as ProductCardType } from "@/lib/catalog";
import { Price, RatingStars, Badge } from "./ui";
import { IconArrowRight, IconHeart } from "./icons";
import { toggleWishlistAction } from "@/app/actions/cart";

export function ProductCard({
  product,
  locale,
  inWishlist = false,
  returnTo,
  priority = false,
  showWishlist = true,
}: {
  product: ProductCardType;
  locale: Locale;
  inWishlist?: boolean;
  returnTo?: string;
  priority?: boolean;
  showWishlist?: boolean;
}) {
  const soldOut = product.stockQuantity <= 0;
  const onSale = product.salePrice !== null && product.salePrice < product.price;
  const lowStock = !soldOut && product.stockQuantity <= 3;

  return (
    <div className="group relative">
      <Link href={`/${locale}/product/${product.slug}`} className="block" aria-label={product.name}>
        <div className="relative aspect-[4/5] overflow-hidden bg-[#f1efe8]">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt || product.name}
              fill
              priority={priority}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs uppercase tracking-widest text-muted">BLOOMÉ</div>
          )}

          <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
            {onSale ? <Badge tone="dusty">{locale === "th" ? "ลดราคา" : "Sale"}</Badge> : null}
            {product.isNew && !onSale ? <Badge tone="primary">{locale === "th" ? "ใหม่" : "New"}</Badge> : null}
            {soldOut ? (
              <Badge tone="neutral">{locale === "th" ? "สินค้าหมด" : "Sold out"}</Badge>
            ) : lowStock ? (
              <Badge tone="warning">{locale === "th" ? "เหลือน้อย" : "Low stock"}</Badge>
            ) : null}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-3 items-center justify-between bg-gradient-to-t from-black/45 to-transparent px-4 pb-3 pt-10 text-[10px] uppercase tracking-[0.16em] text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <span>{locale === "th" ? "ดูรายละเอียด" : "View details"}</span>
            <IconArrowRight size={15} />
          </div>
        </div>

        <div className="pt-3.5">
          <h3 className="line-clamp-2 min-h-[2.9rem] font-serif text-[16px] leading-snug transition-colors group-hover:text-primary-dark">
            {product.name}
          </h3>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <Price value={product.effectivePrice} compareAt={product.price} locale={locale} size="sm" />
            {product.reviewCount > 0 ? (
              <RatingStars value={product.ratingAvg} count={product.reviewCount} size={11} />
            ) : null}
          </div>
        </div>
      </Link>

      {showWishlist ? (
        <form action={toggleWishlistAction} className="absolute right-2.5 top-2.5">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="returnTo" value={returnTo ?? `/${locale}/product/${product.slug}`} />
          <button
            type="submit"
            aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
            className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/85 backdrop-blur transition-all hover:bg-white hover:text-primary-dark ${
              inWishlist ? "text-primary-dark" : "text-charcoal/60"
            }`}
          >
            <IconHeart size={16} fill={inWishlist ? "currentColor" : "none"} />
          </button>
        </form>
      ) : null}
    </div>
  );
}
