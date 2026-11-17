import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader, AdminPeriodTabs, AdminTable, StatCard, StatusDot } from "@/components/admin/ui";
import { CategoryBars, RevenueChart } from "@/components/admin/charts";
import { getDashboardData, resolvePeriod, type PeriodKey } from "@/lib/admin/analytics";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { firstParam } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const PERIODS: PeriodKey[] = ["today", "yesterday", "7d", "30d", "month", "lastMonth"];

export default async function AdminDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.DASHBOARD_VIEW);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const sp = await searchParams;
  const period = (firstParam(sp, "period") as PeriodKey) ?? "7d";
  const { from, to, days } = resolvePeriod(PERIODS.includes(period) ? period : "7d");
  const data = await getDashboardData(from, to, days);

  return (
    <div>
      <AdminPageHeader
        title={t("admin.dashboard")}
        description={`${formatDateTime(from, locale)} — ${formatDateTime(to, locale)}`}
        actions={
          <AdminPeriodTabs
            current={period}
            basePath={`/${locale}/admin`}
            labels={[
              { key: "today", label: t("admin.period.today") },
              { key: "yesterday", label: t("admin.period.yesterday") },
              { key: "7d", label: t("admin.period.7d") },
              { key: "30d", label: t("admin.period.30d") },
              { key: "month", label: t("admin.period.month") },
              { key: "lastMonth", label: t("admin.period.lastMonth") },
            ]}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("admin.totalSales")} value={formatMoney(data.gross, { locale })} hint={`${data.paidOrders} ${locale === "th" ? "คำสั่งซื้อที่ชำระแล้ว" : "paid orders"}`} tone="primary" />
        <StatCard label={t("admin.netRevenue")} value={formatMoney(data.netRevenue, { locale })} hint={`−${formatMoney(data.refunded, { locale })} refunds`} />
        <StatCard label={t("admin.avgOrderValue")} value={formatMoney(data.avgOrderValue, { locale })} hint={`${data.orderCounts.total} ${locale === "th" ? "คำสั่งซื้อทั้งหมด" : "orders total"}`} />
        <StatCard
          label={t("admin.orders")}
          value={String(data.orderCounts.total)}
          hint={`${data.orderCounts.pending} ${locale === "th" ? "รอดำเนินการ" : "pending"}`}
          tone={data.orderCounts.pending > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("admin.newCustomers")} value={String(data.newCustomers)} />
        <StatCard label={t("admin.returningCustomers")} value={String(data.existingCustomers)} />
        <StatCard label={t("status.delivered")} value={String(data.orderCounts.completed)} />
        <StatCard label={t("order.status.cancelled")} value={String(data.orderCounts.cancelled)} tone={data.orderCounts.cancelled > 0 ? "danger" : "default"} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">{t("admin.revenueTrend")}</h2>
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{days} {t("common.days")}</span>
          </div>
          <div className="mt-4">
            <RevenueChart data={data.trend} locale={locale} />
          </div>
        </section>
        <section className="border border-line bg-white p-5">
          <h2 className="text-sm font-medium">{t("admin.salesByCategory")}</h2>
          <div className="mt-4">
            <CategoryBars data={data.salesByCategory} locale={locale} />
          </div>
          <h3 className="mt-6 border-t border-line pt-4 text-[11px] uppercase tracking-[0.14em] text-muted">
            {t("admin.payment")}
          </h3>
          <ul className="mt-2 space-y-1.5 text-[12px]">
            {data.paymentMix.map((row) => (
              <li key={row.method} className="flex justify-between">
                <span>{row.method}</span>
                <span className="text-muted">
                  {row.count} · {formatMoney(row.amount, { locale })}
                </span>
              </li>
            ))}
            {data.paymentMix.length === 0 ? <li className="text-muted">—</li> : null}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">{t("admin.recentOrders")}</h2>
            <Link href={`/${locale}/admin/orders`} className="text-[11px] uppercase tracking-[0.12em] text-primary-dark">
              {t("common.viewAll")}
            </Link>
          </div>
          <AdminTable
            head={[t("order.number"), t("checkout.recipientName"), t("common.status"), t("common.total"), t("common.date")]}
          >
            {data.recentOrders.map((order) => (
              <tr key={order.id} className="hover:bg-[#faf9f5]">
                <td className="px-3 py-2.5 font-mono text-[11px]">
                  <Link href={`/${locale}/admin/orders/${order.id}`} className="hover:text-primary-dark">
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-3 py-2.5">{order.recipient_name}</td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <StatusDot
                      tone={
                        order.status === "delivered"
                          ? "green"
                          : order.status === "cancelled"
                            ? "red"
                            : order.status === "pending_payment"
                              ? "amber"
                              : "grey"
                      }
                    />
                    {t(`order.status.${order.status}` as never)}
                  </span>
                </td>
                <td className="px-3 py-2.5">{formatMoney(order.grand_total, { locale })}</td>
                <td className="px-3 py-2.5 text-[11px] text-muted">{formatDateTime(order.created_at, locale)}</td>
              </tr>
            ))}
            {data.recentOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted">
                  {t("common.empty")}
                </td>
              </tr>
            ) : null}
          </AdminTable>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">{t("admin.lowStock")}</h2>
            <Link href={`/${locale}/admin/inventory`} className="text-[11px] uppercase tracking-[0.12em] text-primary-dark">
              {t("admin.inventory")}
            </Link>
          </div>
          <AdminTable head={[t("product.sku"), t("common.status"), t("common.quantity")]}>
            {data.lowStock.map((product) => (
              <tr key={product.id}>
                <td className="px-3 py-2.5 font-mono text-[11px]">{product.sku}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[11px] ${product.stock_quantity <= 0 ? "text-danger" : "text-warning"}`}>
                    {product.stock_quantity <= 0 ? t("admin.outOfStock") : t("admin.lowStock")}
                  </span>
                </td>
                <td className="px-3 py-2.5">{product.stock_quantity}</td>
              </tr>
            ))}
            {data.lowStock.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted">
                  {t("common.empty")}
                </td>
              </tr>
            ) : null}
          </AdminTable>

          <div className="mt-5">
            <h2 className="mb-2 text-sm font-medium">{t("admin.topProducts")}</h2>
            <AdminTable head={[locale === "th" ? "สินค้า" : "Product", t("common.quantity"), t("admin.revenue")]}>
              {data.topProducts.map((product) => (
                <tr key={product.sku}>
                  <td className="px-3 py-2.5">{locale === "th" ? product.nameTh : product.nameEn}</td>
                  <td className="px-3 py-2.5">{product.quantity}</td>
                  <td className="px-3 py-2.5">{formatMoney(product.revenue, { locale })}</td>
                </tr>
              ))}
              {data.topProducts.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted">
                    {t("common.empty")}
                  </td>
                </tr>
              ) : null}
            </AdminTable>
          </div>
        </section>
      </div>
    </div>
  );
}
