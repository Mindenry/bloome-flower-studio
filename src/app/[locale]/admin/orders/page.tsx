/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader, AdminTable } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { adminListOrders } from "@/lib/orders";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { firstParam, type RawSearchParams } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.ORDER_VIEW);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const sp = await searchParams;
  const query = firstParam(sp, "q") ?? "";
  const status = firstParam(sp, "status") ?? "";
  const page = Math.max(1, Number(firstParam(sp, "page") ?? 1) || 1);

  const result = await adminListOrders({ query, status, page, perPage: 20 });

  return (
    <div>
      <AdminPageHeader
        title={t("admin.orders")}
        description={`${result.total} ${t("common.results")}`}
        actions={
          <a href="/api/admin/export?type=orders" className="btn btn-ghost btn-sm">
            {t("admin.exportCsv")}
          </a>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={query} placeholder={t("admin.searchOrders")} className="input h-9 max-w-sm text-xs" />
        <select name="status" defaultValue={status} className="input h-9 w-auto text-xs">
          <option value="">{t("common.all")}</option>
          {["pending_payment", "awaiting_verification", "paid", "confirmed", "preparing", "arranging", "quality_check", "ready_for_delivery", "out_for_delivery", "delivered", "cancelled", "refund_requested", "refunded"].map((value) => (
            <option key={value} value={value}>
              {t(`order.status.${value}` as never)}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-ghost btn-sm">
          {t("common.search")}
        </button>
      </form>

      <AdminTable
        head={[t("order.number"), locale === "th" ? "ผู้รับ" : "Recipient", t("common.status"), t("order.payment"), t("common.total"), t("order.delivery"), ""]}
      >
        {result.items.map((order) => (
          <tr key={order.id} className="hover:bg-[#faf9f5]">
            <td className="px-3 py-2.5 font-mono text-[11px]">
              <Link href={`/${locale}/admin/orders/${order.id}`} className="hover:text-primary-dark">
                {order.order_number}
              </Link>
              <span className="block text-[10px] text-muted">{formatDateTime(order.created_at, locale)}</span>
            </td>
            <td className="px-3 py-2.5">
              {order.recipient_name}
              <span className="block text-[10px] text-muted">{order.recipient_phone}</span>
            </td>
            <td className="px-3 py-2.5">
              <OrderStatusBadge status={order.status} label={t(`order.status.${order.status}` as never)} />
            </td>
            <td className="px-3 py-2.5 text-[11px]">{t(`payment.status.${order.payment_status}` as never)}</td>
            <td className="px-3 py-2.5">{formatMoney(order.grand_total, { locale })}</td>
            <td className="px-3 py-2.5 text-[11px] text-muted">
              {order.delivery_date ?? "—"}
              {order.delivery_slot_label ? <span className="block">{order.delivery_slot_label}</span> : null}
            </td>
            <td className="px-3 py-2.5">
              <Link href={`/${locale}/admin/orders/${order.id}`} className="text-[11px] text-primary-dark underline underline-offset-2">
                {t("common.edit")}
              </Link>
            </td>
          </tr>
        ))}
        {result.items.length === 0 ? (
          <tr>
            <td colSpan={7} className="px-3 py-8 text-center text-xs text-muted">
              {t("common.empty")}
            </td>
          </tr>
        ) : null}
      </AdminTable>

      {result.totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap gap-1 text-[11px]">
          {Array.from({ length: result.totalPages }).slice(0, 25).map((_, index) => (
            <Link
              key={index}
              href={`/${locale}/admin/orders?page=${index + 1}${query ? `&q=${encodeURIComponent(query)}` : ""}${status ? `&status=${status}` : ""}`}
              className={`flex h-7 min-w-7 items-center justify-center border px-2 ${
                page === index + 1 ? "border-primary bg-primary text-white" : "border-line bg-white"
              }`}
            >
              {index + 1}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
