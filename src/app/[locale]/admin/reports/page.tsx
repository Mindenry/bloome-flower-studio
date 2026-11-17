import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader, AdminPeriodTabs, AdminTable, StatCard } from "@/components/admin/ui";
import { CategoryBars } from "@/components/admin/charts";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { getDashboardData, getSalesReport, resolvePeriod, type PeriodKey } from "@/lib/admin/analytics";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { firstParam, type RawSearchParams } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const PERIODS: PeriodKey[] = ["today", "7d", "30d", "month", "lastMonth"];

export default async function AdminReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.REPORT_VIEW);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const sp = await searchParams;
  const period = ((firstParam(sp, "period") as PeriodKey) ?? "30d") as PeriodKey;
  const { from, to, days } = resolvePeriod(PERIODS.includes(period) ? period : "30d");

  const [report, dashboard] = await Promise.all([getSalesReport(from, to), getDashboardData(from, to, days)]);
  const exportHref = `/api/admin/export?type=orders&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <div>
      <AdminPageHeader
        title={t("admin.reports")}
        description={`${formatDate(from, locale, { dateStyle: "medium" })} — ${formatDate(to, locale, { dateStyle: "medium" })}`}
        actions={
          <>
            <a href={exportHref} className="btn btn-ghost btn-sm">
              {t("admin.exportCsv")}
            </a>
            <AdminPeriodTabs
              current={period}
              basePath={`/${locale}/admin/reports`}
              labels={[
                { key: "today", label: t("admin.period.today") },
                { key: "7d", label: t("admin.period.7d") },
                { key: "30d", label: t("admin.period.30d") },
                { key: "month", label: t("admin.period.month") },
                { key: "lastMonth", label: t("admin.period.lastMonth") },
              ]}
            />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("admin.revenue")} value={formatMoney(report.totals.revenue, { locale })} tone="primary" />
        <StatCard label={t("admin.orders")} value={String(report.totals.orders)} />
        <StatCard label={t("common.discount")} value={formatMoney(report.totals.discounts, { locale })} />
        <StatCard label={t("common.shipping")} value={formatMoney(report.totals.shipping, { locale })} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section>
          <h2 className="mb-2 text-sm font-medium">{locale === "th" ? "ยอดขายรายวัน" : "Daily revenue"}</h2>
          <AdminTable head={[t("common.date"), t("admin.orders"), t("admin.revenue")]}>
            {report.byDay.map((row) => (
              <tr key={row.day}>
                <td className="px-3 py-2.5 text-[11px]">{row.day}</td>
                <td className="px-3 py-2.5">{row.orders}</td>
                <td className="px-3 py-2.5">{formatMoney(row.revenue, { locale })}</td>
              </tr>
            ))}
            {report.byDay.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted">
                  {t("common.empty")}
                </td>
              </tr>
            ) : null}
          </AdminTable>
        </section>

        <section className="border border-line bg-white p-4">
          <h2 className="text-sm font-medium">{t("admin.salesByCategory")}</h2>
          <div className="mt-3">
            <CategoryBars data={dashboard.salesByCategory} locale={locale} />
          </div>
        </section>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium">{locale === "th" ? "รายละเอียดคำสั่งซื้อ" : "Order detail"}</h2>
        <AdminTable head={[t("order.number"), t("common.date"), t("order.recipient"), t("order.payment"), t("common.total"), "Coupon"]}>
          {report.rows.slice(0, 60).map((row) => (
            <tr key={row.order_number}>
              <td className="px-3 py-2.5 font-mono text-[10px]">{row.order_number}</td>
              <td className="px-3 py-2.5 text-[10px] text-muted">{formatDate(row.created_at, locale, { dateStyle: "short" })}</td>
              <td className="px-3 py-2.5 text-[11px]">{row.recipient_name}</td>
              <td className="px-3 py-2.5 text-[11px]">{t(`payment.status.${row.payment_status}` as never)}</td>
              <td className="px-3 py-2.5">{formatMoney(row.grand_total, { locale })}</td>
              <td className="px-3 py-2.5 text-[10px] text-muted">{row.coupon_code ?? "—"}</td>
            </tr>
          ))}
        </AdminTable>
      </section>
    </div>
  );
}
