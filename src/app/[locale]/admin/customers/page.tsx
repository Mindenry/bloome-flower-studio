/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "kysely";
import { AdminPageHeader, AdminTable } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import { firstParam, type RawSearchParams } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.CUSTOMER_VIEW);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const sp = await searchParams;
  const query = firstParam(sp, "q") ?? "";

  const customers = await db
    .selectFrom("users")
    .innerJoin("roles", "roles.id", "users.role_id")
    .leftJoin("orders", "orders.user_id", "users.id")
    .select([
      "users.id",
      "users.name",
      "users.email",
      "users.phone",
      "users.status",
      "users.created_at",
      "users.marketing_consent",
      "roles.slug as role_slug",
      sql<string>`count(distinct orders.id)`.as("order_count"),
      sql<string>`coalesce(sum(case when orders.payment_status = 'succeeded' then orders.grand_total else 0 end), 0)`.as("spent"),
      sql<string>`max(orders.created_at)`.as("last_order"),
    ])
    .where("roles.slug", "=", "customer")
    .where("users.deleted_at", "is", null)
    .where((eb) =>
      query
        ? eb.or([
            eb(sql`lower(users.name)`, "like", `%${query.toLowerCase()}%`),
            eb(sql`lower(users.email)`, "like", `%${query.toLowerCase()}%`),
            eb(sql`users.phone`, "like", `%${query}%`),
          ])
        : eb.val(true),
    )
    .groupBy(["users.id", "users.name", "users.email", "users.phone", "users.status", "users.created_at", "users.marketing_consent", "roles.slug"])
    .orderBy("spent", "desc")
    .limit(100)
    .execute();

  return (
    <div>
      <AdminPageHeader
        title={t("admin.customers")}
        description={`${customers.length} ${t("common.results")}`}
        actions={
          <a href="/api/admin/export?type=customers" className="btn btn-ghost btn-sm">
            {t("admin.exportCsv")}
          </a>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={query} placeholder={t("common.search")} className="input h-9 max-w-sm text-xs" />
        <button type="submit" className="btn btn-ghost btn-sm">
          {t("common.search")}
        </button>
      </form>

      <AdminTable head={[t("auth.name"), t("auth.phone"), t("account.ordersCount"), t("account.totalSpent"), t("common.date"), ""]}>
        {customers.map((customer) => (
          <tr key={customer.id}>
            <td className="px-3 py-2.5">
              <Link href={`/${locale}/admin/customers/${customer.id}`} className="hover:text-primary-dark">
                {customer.name}
              </Link>
              <span className="block text-[10px] text-muted">{customer.email}</span>
              {customer.marketing_consent === 1 ? <span className="text-[9px] uppercase tracking-wider text-success">opt-in</span> : null}
            </td>
            <td className="px-3 py-2.5 text-[11px]">{customer.phone ?? "—"}</td>
            <td className="px-3 py-2.5">{customer.order_count}</td>
            <td className="px-3 py-2.5">{formatMoney(Number(customer.spent), { locale })}</td>
            <td className="px-3 py-2.5 text-[10px] text-muted">
              {customer.last_order ? formatDate(customer.last_order, locale, { dateStyle: "medium" }) : "—"}
            </td>
            <td className="px-3 py-2.5">
              <Link href={`/${locale}/admin/customers/${customer.id}`} className="text-[11px] text-primary-dark underline underline-offset-2">
                {t("common.edit")}
              </Link>
            </td>
          </tr>
        ))}
        {customers.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-8 text-center text-xs text-muted">
              {t("common.empty")}
            </td>
          </tr>
        ) : null}
      </AdminTable>
    </div>
  );
}
