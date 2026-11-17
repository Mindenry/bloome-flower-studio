import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCart } from "@/lib/cart";
import { getSettings } from "@/lib/settings";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { Alert, EmptyState } from "@/components/ui";
import { CartQuantity, CouponForm } from "@/components/cart-controls";
import { IconArrowRight, IconBag, IconLock, IconTruck } from "@/components/icons";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const [cart, settings] = await Promise.all([getCart(locale), getSettings()]);
  const currency = settings.commerce.currency;
  void currency;

  return (
    <div className="container-page py-10 md:py-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{locale === "th" ? "ขั้นตอนที่ 1 จาก 3" : "Step 1 of 3"}</p>
          <h1 className="mt-2 text-[32px] leading-tight">{t("cart.title")}</h1>
        </div>
        <Link href={`/${locale}/shop`} className="hidden text-xs uppercase tracking-[0.16em] text-muted hover:text-primary-dark sm:block">
          {t("cart.continueShopping")}
        </Link>
      </div>

      {cart.items.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title={t("cart.empty")}
            description={t("cart.emptyHint")}
            icon={<IconBag size={30} />}
            action={
              <Link href={`/${locale}/shop`} className="btn btn-primary">
                {t("cart.continueShopping")}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <ul className="divide-y divide-line border-y border-line">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-4 py-5 sm:gap-6">
                  <Link href={`/${locale}/product/${item.slug}`} className="relative h-28 w-24 shrink-0 overflow-hidden bg-[#f1efe8] sm:h-36 sm:w-28">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.name} fill sizes="112px" className="object-cover" />
                    ) : null}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link href={`/${locale}/product/${item.slug}`} className="font-serif text-base hover:text-primary-dark">
                            {item.name}
                          </Link>
                          {item.variantName ? (
                            <p className="mt-1 text-xs text-muted">
                              {t("product.size")}: {item.variantName}
                            </p>
                          ) : null}
                          {item.addons.length > 0 ? (
                            <p className="mt-1 text-xs text-muted">
                              + {item.addons.map((addon) => addon.name).join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{formatMoney(item.lineTotal, { locale })}</p>
                          <p className="mt-1 text-[11px] text-muted">
                            {formatMoney(item.unitPrice + item.addonsTotal, { locale })} × {item.quantity}
                          </p>
                        </div>
                      </div>
                      {item.issues.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                          {item.issues.map((issue, index) => (
                            <li key={`${issue.code}-${index}`} className={`text-[11px] ${issue.severity === "error" ? "text-danger" : "text-warning"}`}>
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="mt-4">
                      <CartQuantity itemId={item.id} quantity={item.quantity} max={item.maxQuantity} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <Link href={`/${locale}/shop`} className="mt-6 inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary-dark sm:hidden">
              {t("cart.continueShopping")}
            </Link>
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-line bg-white p-6">
              <h2 className="text-xl">{t("cart.summary")}</h2>

              <div className="mt-5">
                <p className="label">{t("cart.coupon")}</p>
                <CouponForm currentCode={cart.coupon?.code ?? null} appliedLabel={t("cart.couponApplied")} />
                {cart.coupon && !cart.coupon.valid ? (
                  <p className="mt-2 text-xs text-danger">{cart.coupon.error ? t(cart.coupon.error as never) : t("error.couponInvalid")}</p>
                ) : null}
              </div>

              <dl className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">{t("common.subtotal")}</dt>
                  <dd>{formatMoney(cart.totals.subtotal + cart.totals.addonsTotal, { locale })}</dd>
                </div>
                {cart.totals.discountTotal > 0 ? (
                  <div className="flex justify-between text-primary-dark">
                    <dt>{t("common.discount")}</dt>
                    <dd>−{formatMoney(cart.totals.discountTotal, { locale })}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-muted">{t("common.shipping")}</dt>
                  <dd>{cart.totals.shippingTotal === 0 ? t("common.free") : formatMoney(cart.totals.shippingTotal, { locale })}</dd>
                </div>
                <p className="text-[11px] text-muted">{t("cart.shippingNote")}</p>
                <div className="flex justify-between border-t border-line pt-3 text-base">
                  <dt className="font-medium">{t("common.total")}</dt>
                  <dd className="font-medium">{formatMoney(cart.totals.grandTotal, { locale })}</dd>
                </div>
                {settings.commerce.pricesIncludeTax ? (
                  <p className="text-[11px] text-muted">
                    {locale === "th"
                      ? `รวมภาษีมูลค่าเพิ่ม 7% (${formatMoney(cart.totals.taxTotal, { locale })})`
                      : `Includes 7% VAT (${formatMoney(cart.totals.taxTotal, { locale })})`}
                  </p>
                ) : null}
              </dl>

              {cart.freeShippingRemaining > 0 && !cart.totals.freeShippingApplied ? (
                <p className="mt-4 flex items-center gap-2 text-[11px] text-muted">
                  <IconTruck size={14} className="text-primary" />
                  {t("cart.freeShippingProgress", { amount: formatMoney(cart.freeShippingRemaining, { locale }) })}
                </p>
              ) : null}
              {cart.totals.freeShippingApplied ? (
                <p className="mt-4 flex items-center gap-2 text-[11px] text-success">
                  <IconTruck size={14} />
                  {t("cart.freeShippingReached")}
                </p>
              ) : null}

              {cart.hasBlockingIssues ? (
                <div className="mt-5">
                  <Alert tone="danger">{t("cart.outOfStockWarning")}</Alert>
                </div>
              ) : (
                <Link href={`/${locale}/checkout`} className="btn btn-primary mt-6 w-full">
                  {t("cart.checkout")}
                  <IconArrowRight size={16} />
                </Link>
              )}

              <p className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted">
                <IconLock size={13} />
                {t("checkout.payment.secureNote")}
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
