import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { getOrderByNumber } from "@/lib/orders";
import { getCurrentUser } from "@/lib/auth/session";
import { hasOrderAccess } from "@/lib/order-access";
import { getSettings } from "@/lib/settings";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const DOC_TYPES = ["invoice", "packing", "delivery", "checklist"] as const;
type DocType = (typeof DOC_TYPES)[number];

export default async function PrintOrderPage({
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
  const typeParam = typeof sp.type === "string" ? sp.type : "invoice";
  const type: DocType = (DOC_TYPES as readonly string[]).includes(typeParam) ? (typeParam as DocType) : "invoice";

  const order = await getOrderByNumber(number);
  if (!order) notFound();
  const user = await getCurrentUser();
  const allowed = (order.userId && user?.id === order.userId) || (await hasOrderAccess(order.id));
  if (!allowed) redirect(`/${locale}/order/track`);

  const settings = await getSettings();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const docTitles: Record<DocType, string> = {
    invoice: t("order.invoice"),
    packing: t("order.packingSlip"),
    delivery: t("order.deliveryNote"),
    checklist: t("order.arrangementChecklist"),
  };

  return (
    <div className="min-h-screen bg-cream py-8 print:bg-white">
      <div className="print-page mx-auto max-w-3xl bg-white p-8 shadow-soft print:shadow-none">
        <div className="no-print mb-6 flex items-center justify-between">
          <Link href={`/${locale}/order/${order.orderNumber}`} className="text-xs text-muted hover:text-primary-dark">
            ← {t("common.back")}
          </Link>
          <PrintButton label={t("common.print")} />
        </div>

        <header className="flex items-start justify-between border-b border-line pb-6">
          <div>
            <p className="font-serif text-xl tracking-[0.22em]">{settings.store.nameEn.replace(" FLOWER STUDIO", "")}</p>
            <p className="mt-1 text-[8px] uppercase tracking-[0.4em] text-muted">Flower Studio</p>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              {settings.store.addressEn}
              <br />
              {settings.store.phone} · {settings.store.email}
              {settings.store.taxId ? (
                <>
                  <br />
                  Tax ID: {settings.store.taxId}
                </>
              ) : null}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm uppercase tracking-[0.18em]">{docTitles[type]}</p>
            <p className="mt-2 font-mono text-sm">{order.orderNumber}</p>
            <p className="mt-1 text-[11px] text-muted">
              {formatDate(order.createdAt, locale, { dateStyle: "long" })}
            </p>
          </div>
        </header>

        <section className="mt-6 grid gap-6 text-[11px] sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{locale === "th" ? "ผู้สั่งซื้อ" : "Customer"}</p>
            <p className="mt-1 text-sm">{order.customerName}</p>
            <p className="text-muted">{order.customerPhone}</p>
            <p className="text-muted">{order.email}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("order.recipient")}</p>
            <p className="mt-1 text-sm">{order.recipientName}</p>
            <p className="text-muted">{order.recipientPhone}</p>
            <p className="text-muted">
              {order.addressLine} {order.subdistrict} {order.district} {order.province} {order.postalCode}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("order.delivery")}</p>
            <p className="mt-1 text-sm">
              {order.deliveryDate ? formatDate(`${order.deliveryDate}T12:00:00+07:00`, locale, { dateStyle: "medium" }) : "—"}
              {order.deliverySlotLabel ? ` · ${order.deliverySlotLabel}` : ""}
            </p>
            {order.deliveryNotes ? <p className="text-muted">{order.deliveryNotes}</p> : null}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("order.payment")}</p>
            <p className="mt-1 text-sm">{t(`payment.status.${order.paymentStatus}` as never)}</p>
            <p className="text-muted">{order.payments[0]?.method ?? "—"}</p>
          </div>
        </section>

        {order.giftMessage ? (
          <section className="mt-6 border border-line p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("order.giftMessage")}</p>
            <p className="mt-1 font-serif text-sm">“{order.giftMessage}”</p>
            <p className="mt-1 text-[11px] text-muted">{order.anonymous ? t("checkout.anonymous") : order.senderName}</p>
          </section>
        ) : null}

        <table className="mt-6 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-y border-line text-left uppercase tracking-[0.1em] text-muted">
              <th className="py-2">#</th>
              <th className="py-2">{locale === "th" ? "รายการ" : "Item"}</th>
              <th className="py-2">SKU</th>
              <th className="py-2 text-right">{t("common.quantity")}</th>
              {type === "invoice" || type === "packing" ? <th className="py-2 text-right">{t("common.price")}</th> : null}
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={item.id} className="border-b border-line align-top">
                <td className="py-2">{index + 1}</td>
                <td className="py-2">
                  {locale === "th" ? item.nameTh : item.nameEn}
                  {item.variantNameTh || item.variantNameEn ? (
                    <span className="block text-muted">{locale === "th" ? item.variantNameTh : item.variantNameEn}</span>
                  ) : null}
                  {item.addons.length > 0 ? (
                    <span className="block text-muted">
                      + {item.addons.map((addon) => (locale === "th" ? addon.nameTh : addon.nameEn)).join(", ")}
                    </span>
                  ) : null}
                </td>
                <td className="py-2 font-mono text-[10px]">{item.sku}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                {type === "invoice" || type === "packing" ? (
                  <td className="py-2 text-right">{formatMoney(item.lineTotal, { locale })}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>

        {type === "invoice" ? (
          <div className="mt-5 ml-auto max-w-xs text-[11px]">
            <div className="flex justify-between py-1">
              <span className="text-muted">{t("common.subtotal")}</span>
              <span>{formatMoney(order.subtotal + order.addonsTotal, { locale })}</span>
            </div>
            {order.discountTotal > 0 ? (
              <div className="flex justify-between py-1">
                <span className="text-muted">{t("common.discount")}</span>
                <span>−{formatMoney(order.discountTotal, { locale })}</span>
              </div>
            ) : null}
            <div className="flex justify-between py-1">
              <span className="text-muted">{t("common.shipping")}</span>
              <span>{order.shippingTotal === 0 ? t("common.free") : formatMoney(order.shippingTotal, { locale })}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-line py-2 text-sm">
              <span>{t("common.total")}</span>
              <span>{formatMoney(order.grandTotal, { locale })}</span>
            </div>
            <p className="mt-2 text-[9px] text-muted">
              {locale === "th"
                ? `ราคารวมภาษีมูลค่าเพิ่ม 7% (${formatMoney(order.taxTotal, { locale })})`
                : `Includes 7% VAT (${formatMoney(order.taxTotal, { locale })})`}
            </p>
          </div>
        ) : null}

        {type === "checklist" ? (
          <section className="mt-6 text-[11px]">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("order.arrangementChecklist")}</p>
            <ul className="mt-2 space-y-1.5">
              {[
                locale === "th" ? "ตรวจสอบจำนวนดอกและชนิดตามรายการ" : "Verify stem count and varieties",
                locale === "th" ? "ตัดแต่งก้านและใบให้เรียบร้อย" : "Clean stems and foliage",
                locale === "th" ? "ตรวจสอบความสดของดอกทุกดอก" : "Check freshness of every stem",
                locale === "th" ? "จัดเรียงตามภาพตัวอย่าง" : "Match the reference composition",
                locale === "th" ? "แนบการ์ดข้อความและของขวัญเพิ่มเติม" : "Attach card and add-ons",
                locale === "th" ? "ตรวจสอบที่อยู่ผู้รับก่อนส่ง" : "Confirm recipient address",
                locale === "th" ? "ถ่ายภาพสินค้าก่อนจัดส่ง" : "Photograph before dispatch",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="inline-block h-3 w-3 border border-charcoal" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {order.customerNote ? (
          <section className="mt-6 border-t border-line pt-4 text-[11px]">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{t("checkout.customerNote")}</p>
            <p className="mt-1">{order.customerNote}</p>
          </section>
        ) : null}

        <footer className="mt-10 flex justify-between gap-8 border-t border-line pt-6 text-[10px] text-muted">
          <div>
            <p>{locale === "th" ? "ผู้จัดทำ" : "Prepared by"}</p>
            <div className="mt-6 w-40 border-t border-charcoal/30" />
          </div>
          <div>
            <p>{locale === "th" ? "ผู้ส่งมอบ" : "Delivered by"}</p>
            <div className="mt-6 w-40 border-t border-charcoal/30" />
          </div>
          <div className="text-right">
            <p>{settings.store.nameEn}</p>
            <p>{settings.store.tagline}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
