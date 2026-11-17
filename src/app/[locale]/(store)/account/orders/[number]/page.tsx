import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { OrderStatusBadge } from "@/components/ui";
import { ReviewForm } from "@/components/review-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserOrder } from "@/lib/orders";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountOrderDetail({
  params,
}: {
  params: Promise<{ locale: string; number: string }>;
}) {
  const { locale: raw, number } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const order = await getUserOrder(user.id, number);
  if (!order) notFound();

  const reviewed = await db
    .selectFrom("reviews")
    .select("order_item_id")
    .where("order_id", "=", order.id)
    .execute();
  const reviewedIds = new Set(reviewed.map((row) => row.order_item_id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{t("payment.orderNumber")}</p>
          <p className="mt-1 font-mono text-lg">{order.orderNumber}</p>
          <p className="text-[11px] text-muted">{formatDateTime(order.createdAt, locale)}</p>
        </div>
        <OrderStatusBadge status={order.status} label={t(`order.status.${order.status}` as never)} />
      </div>

      <section className="card p-5">
        <h3 className="text-lg">{t("order.items")}</h3>
        <ul className="mt-4 divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="py-4 first:pt-0">
              <div className="flex gap-4">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-[#f1efe8]">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={locale === "th" ? item.nameTh : item.nameEn} fill sizes="64px" className="object-cover" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <p className="font-serif">{locale === "th" ? item.nameTh : item.nameEn}</p>
                  <p className="text-[11px] text-muted">
                    {formatMoney(item.unitPrice, { locale })} × {item.quantity}
                  </p>
                  {item.slug ? (
                    <Link href={`/${locale}/product/${item.slug}`} className="mt-1 inline-block text-[11px] text-primary-dark underline underline-offset-2">
                      {t("product.addToCart")}
                    </Link>
                  ) : null}
                </div>
                <p className="text-sm">{formatMoney(item.lineTotal, { locale })}</p>
              </div>
              {order.status === "delivered" ? (
                <div className="mt-3">
                  {reviewedIds.has(item.id) ? (
                    <p className="text-[11px] text-success">{t("review.already")}</p>
                  ) : (
                    <details open={order.status === "delivered"}>
                      <summary className="cursor-pointer text-xs text-primary-dark">{t("account.reviewCta")}</summary>
                      <div className="mt-3">
                        <ReviewForm orderItemId={item.id} productName={locale === "th" ? item.nameTh : item.nameEn} />
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-muted">{t("review.onlyPurchased")}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card p-5 text-sm">
          <h3 className="text-lg">{t("order.delivery")}</h3>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {order.recipientName}
            <br />
            {order.recipientPhone}
            <br />
            {order.addressLine} {order.subdistrict} {order.district} {order.province} {order.postalCode}
            <br />
            {order.deliveryDate ? formatDate(`${order.deliveryDate}T12:00:00+07:00`, locale, { dateStyle: "full" }) : ""}{" "}
            {order.deliverySlotLabel ?? ""}
          </p>
          {order.giftMessage ? (
            <p className="mt-3 border-t border-line pt-3 font-serif text-sm">“{order.giftMessage}”</p>
          ) : null}
        </section>

        <section className="card p-5 text-sm">
          <h3 className="text-lg">{t("order.payment")}</h3>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted">{t("common.subtotal")}</dt>
              <dd>{formatMoney(order.subtotal + order.addonsTotal, { locale })}</dd>
            </div>
            {order.discountTotal > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted">{t("common.discount")}</dt>
                <dd>−{formatMoney(order.discountTotal, { locale })}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted">{t("common.shipping")}</dt>
              <dd>{formatMoney(order.shippingTotal, { locale })}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-sm">
              <dt>{t("common.total")}</dt>
              <dd>{formatMoney(order.grandTotal, { locale })}</dd>
            </div>
            <div className="flex justify-between pt-2">
              <dt className="text-muted">{t("common.status")}</dt>
              <dd>{t(`payment.status.${order.paymentStatus}` as never)}</dd>
            </div>
          </dl>
          <Link href={`/${locale}/order/${order.orderNumber}`} className="btn btn-outline btn-sm mt-4 w-full">
            {t("account.trackOrder")}
          </Link>
        </section>
      </div>
    </div>
  );
}
