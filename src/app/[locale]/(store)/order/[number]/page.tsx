import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { PaymentPanel } from "@/components/payment-panel";
import { Alert, Breadcrumbs, OrderStatusBadge } from "@/components/ui";
import { IconCalendar, IconCheck, IconClock, IconPackage, IconPrinter, IconTruck } from "@/components/icons";
import { getOrderByNumber } from "@/lib/orders";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrderAccess } from "@/lib/order-access";
import { getSettings } from "@/lib/settings";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";
import { cancelMyOrderAction, requestRefundAction } from "@/app/actions/order";
import { env } from "@/lib/env";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const STATUS_FLOW = [
  "pending_payment",
  "paid",
  "confirmed",
  "preparing",
  "arranging",
  "quality_check",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
];

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; number: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw, number } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const sp = await searchParams;
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const order = await getOrderByNumber(number);
  if (!order) notFound();

  const user = await getCurrentUser();
  const allowed = (order.userId && user?.id === order.userId) || (await hasOrderAccess(order.id));
  if (!allowed) {
    redirect(`/${locale}/order/track?number=${encodeURIComponent(order.orderNumber)}`);
  }

  const [settings] = await Promise.all([getSettings()]);
  const payment = order.payments[0] ?? null;
  const canCancel = ["pending_payment", "awaiting_verification"].includes(order.status);
  const canRequestRefund = ["paid", "confirmed", "preparing", "arranging", "quality_check", "ready_for_delivery", "out_for_delivery", "delivered"].includes(order.status) && order.paymentStatus === "succeeded";

  const currentIndex = STATUS_FLOW.indexOf(order.status);
  const timelineStatuses = order.status === "cancelled" || order.status === "refunded" || order.status === "refund_requested"
    ? []
    : STATUS_FLOW;

  return (
    <div className="container-page py-10 md:py-14">
      <Breadcrumbs
        items={[
          { label: t("nav.home"), href: `/${locale}` },
          { label: t("account.orders"), href: `/${locale}/account/orders` },
          { label: order.orderNumber },
        ]}
      />

      {sp.placed === "1" ? (
        <div className="mb-6">
          <Alert tone="success" title={t("checkout.stockReserved")}>
            {t("payment.orderNumber")}: <strong>{order.orderNumber}</strong>
          </Alert>
        </div>
      ) : null}
      {sp.cancelled === "1" ? (
        <div className="mb-6">
          <Alert tone="info">{t("order.cancelled")}</Alert>
        </div>
      ) : null}
      {sp.refund === "1" ? (
        <div className="mb-6">
          <Alert tone="info">{locale === "th" ? "ส่งคำขอคืนเงินแล้ว ทีมงานจะติดต่อกลับ" : "Refund request received — we'll be in touch."}</Alert>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{t("payment.orderNumber")}</p>
          <h1 className="mt-2 font-serif text-[28px] tracking-wide sm:text-[34px]">{order.orderNumber}</h1>
          <p className="mt-2 text-xs text-muted">
            {formatDateTime(order.createdAt, locale)} · {order.items.length} {t("common.items")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} label={t(`order.status.${order.status}` as never)} />
          {order.paymentStatus === "succeeded" ? <span className="text-[11px] uppercase tracking-[0.14em] text-success">{t("payment.paid")}</span> : null}
        </div>
      </div>

      {/* Status timeline */}
      {timelineStatuses.length > 0 ? (
        <ol className="mt-8 grid gap-2 border-y border-line py-5 sm:grid-cols-3 lg:grid-cols-5">
          {timelineStatuses.map((status, index) => {
            const done = index <= currentIndex;
            return (
              <li key={status} className="flex items-center gap-2 text-[11px]">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                    done ? "border-primary bg-primary text-white" : "border-line bg-white text-muted"
                  }`}
                >
                  {done ? <IconCheck size={12} /> : index + 1}
                </span>
                <span className={done ? "text-charcoal" : "text-muted"}>{t(`order.status.${status}` as never)}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {payment && payment.status !== "succeeded" ? (
            <PaymentPanel
              orderNumber={order.orderNumber}
              payment={{
                id: payment.id,
                status: payment.status,
                method: payment.method,
                amount: payment.amount,
                qrPayload: payment.qrPayload,
                checkoutUrl: payment.checkoutUrl,
                expiresAt: payment.expiresAt,
              }}
              bank={{
                name: settings.payment.bankName,
                accountName: settings.payment.bankAccountName,
                accountNumber: settings.payment.bankAccountNumber,
              }}
              isSandbox={payment.provider === "sandbox" && !env.isProduction}
            />
          ) : null}

          <section className="border border-line bg-white">
            <header className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="text-lg">{t("order.items")}</h2>
              <Link href={`/${locale}/order/${order.orderNumber}/print?type=invoice`} className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-primary-dark">
                <IconPrinter size={14} />
                {t("order.invoice")}
              </Link>
            </header>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 px-6 py-4">
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-[#f1efe8]">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={locale === "th" ? item.nameTh : item.nameEn} fill sizes="64px" className="object-cover" />
                    ) : null}
                  </div>
                  <div className="flex-1">
                    <p className="font-serif text-base">{locale === "th" ? item.nameTh : item.nameEn}</p>
                    <p className="mt-0.5 text-[11px] text-muted">SKU {item.sku}</p>
                    {item.variantNameTh || item.variantNameEn ? (
                      <p className="text-[11px] text-muted">{locale === "th" ? item.variantNameTh : item.variantNameEn}</p>
                    ) : null}
                    {item.addons.length > 0 ? (
                      <p className="mt-1 text-[11px] text-muted">
                        + {item.addons.map((addon) => (locale === "th" ? addon.nameTh : addon.nameEn)).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right text-sm">
                    <p>{formatMoney(item.lineTotal, { locale })}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      {formatMoney(item.unitPrice, { locale })} × {item.quantity}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-6 py-5">
              <dl className="ml-auto max-w-xs space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">{t("common.subtotal")}</dt>
                  <dd>{formatMoney(order.subtotal + order.addonsTotal, { locale })}</dd>
                </div>
                {order.discountTotal > 0 ? (
                  <div className="flex justify-between text-primary-dark">
                    <dt>{t("common.discount")}</dt>
                    <dd>−{formatMoney(order.discountTotal, { locale })}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-muted">{t("common.shipping")}</dt>
                  <dd>{order.shippingTotal === 0 ? t("common.free") : formatMoney(order.shippingTotal, { locale })}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-base font-medium">
                  <dt>{t("common.total")}</dt>
                  <dd>{formatMoney(order.grandTotal, { locale })}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="border border-line bg-white p-6">
            <h2 className="text-lg">{t("order.timeline")}</h2>
            <ol className="mt-5 space-y-4">
              {order.events.filter((event) => event.visible).map((event) => (
                <li key={event.id} className="flex gap-4 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p>{event.toStatus ? t(`order.status.${event.toStatus}` as never) : event.message}</p>
                    <p className="text-[11px] text-muted">{formatDateTime(event.createdAt, locale)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="border border-line bg-white p-6 text-sm">
            <h2 className="text-lg">{t("order.delivery")}</h2>
            <div className="mt-4 space-y-3 text-xs">
              <p className="flex items-start gap-2">
                <IconCalendar size={15} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  {order.deliveryDate ? formatDate(`${order.deliveryDate}T12:00:00+07:00`, locale, { dateStyle: "full" }) : "—"}
                  {order.deliverySlotLabel ? <span className="block text-muted">{order.deliverySlotLabel}</span> : null}
                </span>
              </p>
              <p className="flex items-start gap-2">
                <IconTruck size={15} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  {order.recipientName}
                  <span className="block text-muted">{order.recipientPhone}</span>
                  <span className="block text-muted">
                    {order.addressLine} {order.subdistrict} {order.district} {order.province} {order.postalCode}
                  </span>
                </span>
              </p>
              {order.shipping?.trackingNumber ? (
                <p className="flex items-start gap-2">
                  <IconPackage size={15} className="mt-0.5 shrink-0 text-primary" />
                  <span>
                    {order.shipping.carrier ?? "Courier"}
                    <span className="block font-mono text-muted">{order.shipping.trackingNumber}</span>
                  </span>
                </p>
              ) : null}
              {order.giftMessage ? (
                <div className="border-t border-line pt-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{t("order.giftMessage")}</p>
                  <p className="mt-1.5 font-serif text-sm leading-relaxed">“{order.giftMessage}”</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {order.anonymous ? t("checkout.anonymous") : order.senderName}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="border border-line bg-white p-6 text-sm">
            <h2 className="text-lg">{t("order.payment")}</h2>
            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted">{t("common.status")}</dt>
                <dd>{t(`payment.status.${order.paymentStatus}` as never)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t("checkout.paymentMethod")}</dt>
                <dd>{payment ? t(`checkout.payment.${payment.method === "bank_transfer" ? "bank" : payment.method}` as never) : "—"}</dd>
              </div>
              {order.paidAt ? (
                <div className="flex justify-between">
                  <dt className="text-muted">{t("payment.paid")}</dt>
                  <dd>{formatDateTime(order.paidAt, locale)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="border border-line bg-white p-6">
            <h2 className="text-lg">{t("admin.printDocs")}</h2>
            <div className="mt-3 grid gap-2 text-xs">
              {[
                { type: "invoice", label: t("order.invoice") },
                { type: "packing", label: t("order.packingSlip") },
                { type: "delivery", label: t("order.deliveryNote") },
                { type: "checklist", label: t("order.arrangementChecklist") },
              ].map((doc) => (
                <Link
                  key={doc.type}
                  href={`/${locale}/order/${order.orderNumber}/print?type=${doc.type}`}
                  className="flex items-center justify-between border border-line px-3 py-2 hover:border-primary"
                >
                  {doc.label}
                  <IconPrinter size={14} className="text-muted" />
                </Link>
              ))}
            </div>
          </section>

          {canCancel ? (
            <details className="border border-line bg-white p-6">
              <summary className="cursor-pointer text-sm text-danger">{t("account.cancelOrder")}</summary>
              <p className="mt-2 text-[11px] text-muted">{t("order.cancelConfirm")}</p>
              <form action={cancelMyOrderAction} className="mt-3">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="orderNumber" value={order.orderNumber} />
                <button type="submit" className="btn btn-ghost btn-sm w-full">
                  {t("common.confirm")}
                </button>
              </form>
            </details>
          ) : null}

          {canRequestRefund ? (
            <details className="border border-line bg-white p-6">
              <summary className="cursor-pointer text-sm">{locale === "th" ? "ขอคืนเงิน" : "Request a refund"}</summary>
              <form action={requestRefundAction} className="mt-3 space-y-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="orderNumber" value={order.orderNumber} />
                <textarea name="reason" className="textarea" rows={3} placeholder={t("admin.refundReason")} maxLength={400} />
                <button type="submit" className="btn btn-ghost btn-sm w-full">
                  {t("common.confirm")}
                </button>
              </form>
            </details>
          ) : null}

          <div className="border border-line bg-cream p-6 text-xs text-muted">
            <p className="flex items-center gap-2 text-charcoal">
              <IconClock size={14} className="text-primary" />
              {locale === "th" ? "ต้องการความช่วยเหลือ?" : "Need help?"}
            </p>
            <p className="mt-2">
              {settings.store.phone} · {settings.store.email}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
