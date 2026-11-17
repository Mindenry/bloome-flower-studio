import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/ui";
import { NoteForm, RefundForm, StatusUpdateForm, TrackingForm } from "@/components/admin/order-controls";
import { OrderStatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { getOrderDetail, ORDER_TRANSITIONS } from "@/lib/orders";
import { verifyPaymentAction } from "@/app/actions/admin-orders";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import type { OrderStatus } from "@/lib/db/schema";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.ORDER_VIEW);
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const statusOptions = ORDER_TRANSITIONS[order.status as OrderStatus]
    .filter((value) => value !== "paid" && value !== "awaiting_verification")
    .map((value) => ({ value, label: t(`order.status.${value}` as never) }));
  if (statusOptions.length === 0) {
    statusOptions.push({ value: "cancelled", label: t("order.status.cancelled") });
  }

  const payment = order.payments[0] ?? null;
  const refundable = payment && ["succeeded", "partially_refunded"].includes(payment.status)
    ? payment.amount - order.refundedTotal
    : 0;

  return (
    <div>
      <AdminPageHeader
        title={order.orderNumber}
        description={`${formatDateTime(order.createdAt, locale)} · ${t(`payment.status.${order.paymentStatus}` as never)}`}
        actions={
          <>
            <OrderStatusBadge status={order.status} label={t(`order.status.${order.status}` as never)} />
            <Link href={`/${locale}/order/${order.orderNumber}/print?type=invoice`} target="_blank" className="btn btn-ghost btn-sm">
              {t("order.invoice")}
            </Link>
            <Link href={`/${locale}/admin/orders`} className="btn btn-ghost btn-sm">
              {t("common.back")}
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <section className="border border-line bg-white">
            <h2 className="border-b border-line px-4 py-3 text-sm font-medium">{t("order.items")}</h2>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-3 text-[13px]">
                  <div>
                    <p>{locale === "th" ? item.nameTh : item.nameEn}</p>
                    <p className="text-[10px] text-muted">
                      {item.sku}
                      {item.variantNameTh ? ` · ${item.variantNameTh}` : ""}
                    </p>
                    {item.addons.length > 0 ? (
                      <p className="text-[10px] text-muted">
                        + {item.addons.map((addon) => addon.nameTh).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p>{formatMoney(item.lineTotal, { locale })}</p>
                    <p className="text-[10px] text-muted">
                      {formatMoney(item.unitPrice, { locale })} × {item.quantity}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-line px-4 py-3 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-muted">{t("common.subtotal")}</dt>
                <dd>{formatMoney(order.subtotal + order.addonsTotal, { locale })}</dd>
              </div>
              {order.discountTotal > 0 ? (
                <div className="flex justify-between text-primary-dark">
                  <dt>{t("common.discount")} {order.couponCode ? `(${order.couponCode})` : ""}</dt>
                  <dd>−{formatMoney(order.discountTotal, { locale })}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted">{t("common.shipping")}</dt>
                <dd>{formatMoney(order.shippingTotal, { locale })}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t("common.tax")} (VAT)</dt>
                <dd>{formatMoney(order.taxTotal, { locale })}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-sm font-medium">
                <dt>{t("common.total")}</dt>
                <dd>{formatMoney(order.grandTotal, { locale })}</dd>
              </div>
              {order.refundedTotal > 0 ? (
                <div className="flex justify-between text-danger">
                  <dt>{t("admin.manualRefund")}</dt>
                  <dd>−{formatMoney(order.refundedTotal, { locale })}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="border border-line bg-white p-4 text-[12px]">
              <h2 className="mb-2 text-sm font-medium">{t("checkout.step.contact")}</h2>
              <p>{order.customerName}</p>
              <p className="text-muted">{order.customerPhone}</p>
              <p className="text-muted">{order.email}</p>
              {order.userId ? (
                <Link href={`/${locale}/admin/customers/${order.userId}`} className="mt-2 inline-block text-[11px] text-primary-dark underline underline-offset-2">
                  {t("admin.customers")}
                </Link>
              ) : (
                <p className="mt-2 text-[10px] text-muted">Guest checkout</p>
              )}
            </div>
            <div className="border border-line bg-white p-4 text-[12px]">
              <h2 className="mb-2 text-sm font-medium">{t("order.recipient")}</h2>
              <p>{order.recipientName}</p>
              <p className="text-muted">{order.recipientPhone}</p>
              <p className="mt-1 leading-relaxed text-muted">
                {order.addressLine} {order.subdistrict} {order.district} {order.province} {order.postalCode}
              </p>
              {order.deliveryNotes ? <p className="mt-1 text-[11px]">{order.deliveryNotes}</p> : null}
            </div>
          </section>

          <section className="border border-line bg-white p-4 text-[12px]">
            <h2 className="mb-2 text-sm font-medium">{t("order.timeline")}</h2>
            <ol className="space-y-2">
              {order.events.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p>
                      {event.toStatus ? t(`order.status.${event.toStatus}` as never) : event.type}
                      {event.visible ? null : <span className="ml-2 text-[9px] uppercase tracking-wider text-warning">internal</span>}
                    </p>
                    {event.message && event.message !== event.type ? (
                      <p className="text-[11px] text-muted">{event.message}</p>
                    ) : null}
                    <p className="text-[10px] text-muted">{formatDateTime(event.createdAt, locale)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="border border-line bg-white p-4">
            <h2 className="mb-2 text-sm font-medium">{t("admin.updateStatus")}</h2>
            <StatusUpdateForm
              locale={locale}
              orderId={order.id}
              label={t("common.status")}
              options={statusOptions}
            />
          </section>

          <section className="border border-line bg-white p-4 text-[12px]">
            <h2 className="mb-2 text-sm font-medium">{t("order.payment")}</h2>
            {payment ? (
              <dl className="space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-muted">Provider</dt>
                  <dd>{payment.provider}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Method</dt>
                  <dd>{payment.method}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{t("common.status")}</dt>
                  <dd>{t(`payment.status.${payment.status}` as never)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{t("payment.amount")}</dt>
                  <dd>{formatMoney(payment.amount, { locale })}</dd>
                </div>
                {payment.providerReference ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">Ref</dt>
                    <dd className="truncate font-mono text-[10px]">{payment.providerReference}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-muted">—</p>
            )}
            {payment && ["pending", "processing", "awaiting_verification"].includes(payment.status) ? (
              <form action={verifyPaymentAction} className="mt-3">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="paymentId" value={payment.id} />
                <input type="hidden" name="orderId" value={order.id} />
                <button type="submit" className="btn btn-primary btn-sm w-full">
                  {t("admin.markPaid")}
                </button>
              </form>
            ) : null}
            {refundable > 0 ? (
              <div className="mt-4 border-t border-line pt-3">
                <RefundForm locale={locale} orderId={order.id} maxAmount={refundable} />
              </div>
            ) : null}
          </section>

          <section className="border border-line bg-white p-4">
            <h2 className="mb-2 text-sm font-medium">{t("admin.shipping")}</h2>
            <TrackingForm
              locale={locale}
              orderId={order.id}
              carrier={order.shipping?.carrier ?? null}
              trackingNumber={order.shipping?.trackingNumber ?? null}
              note={null}
            />
          </section>

          <section className="border border-line bg-white p-4 text-[12px]">
            <h2 className="mb-2 text-sm font-medium">{t("order.delivery")}</h2>
            <p className="text-muted">
              {order.deliveryDate ? formatDate(`${order.deliveryDate}T12:00:00+07:00`, locale, { dateStyle: "full" }) : "—"}
              {order.deliverySlotLabel ? ` · ${order.deliverySlotLabel}` : ""}
            </p>
            {order.giftMessage ? (
              <div className="mt-2 border-t border-line pt-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{t("order.giftMessage")}</p>
                <p className="mt-1 font-serif">“{order.giftMessage}”</p>
                <p className="text-[10px] text-muted">{order.anonymous ? t("checkout.anonymous") : order.senderName}</p>
              </div>
            ) : null}
            {order.customerNote ? (
              <div className="mt-2 border-t border-line pt-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{t("checkout.customerNote")}</p>
                <p className="mt-1">{order.customerNote}</p>
              </div>
            ) : null}
          </section>

          <section className="border border-line bg-white p-4">
            <h2 className="mb-2 text-sm font-medium">{t("admin.internalNote")}</h2>
            <NoteForm locale={locale} orderId={order.id} internalNote={order.internalNote} />
          </section>
        </aside>
      </div>
    </div>
  );
}
