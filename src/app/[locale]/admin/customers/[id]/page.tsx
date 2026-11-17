import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "kysely";
import { AdminPageHeader, AdminTable } from "@/components/admin/ui";
import { Badge, OrderStatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminCustomerDetail({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.CUSTOMER_VIEW);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const user = await db
    .selectFrom("users")
    .innerJoin("roles", "roles.id", "users.role_id")
    .select([
      "users.id",
      "users.name",
      "users.email",
      "users.phone",
      "users.status",
      "users.locale",
      "users.marketing_consent",
      "users.created_at",
      "users.last_login_at",
      "roles.name as role_name",
    ])
    .where("users.id", "=", id)
    .executeTakeFirst();
  if (!user) notFound();

  const [orders, addresses, stats] = await Promise.all([
    db
      .selectFrom("orders")
      .select(["id", "order_number", "status", "payment_status", "grand_total", "created_at", "recipient_name"])
      .where("user_id", "=", id)
      .orderBy("created_at", "desc")
      .limit(30)
      .execute(),
    db.selectFrom("addresses").selectAll().where("user_id", "=", id).where("deleted_at", "is", null).execute(),
    db
      .selectFrom("orders")
      .select([
        sql<string>`count(*)`.as("count"),
        sql<string>`coalesce(sum(case when payment_status = 'succeeded' then grand_total else 0 end), 0)`.as("spent"),
      ])
      .where("user_id", "=", id)
      .executeTakeFirst(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title={user.name}
        description={`${user.email ?? "—"} · ${user.role_name}`}
        actions={
          <Link href={`/${locale}/admin/customers`} className="btn btn-ghost btn-sm">
            {t("common.back")}
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section>
          <h2 className="mb-2 text-sm font-medium">{t("admin.orders")}</h2>
          <AdminTable head={[t("order.number"), t("order.recipient"), t("common.status"), t("common.total"), t("common.date")]}>
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-3 py-2.5 font-mono text-[10px]">
                  <Link href={`/${locale}/admin/orders/${order.id}`} className="hover:text-primary-dark">
                    {order.order_number}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-[11px]">{order.recipient_name}</td>
                <td className="px-3 py-2.5">
                  <OrderStatusBadge status={order.status} label={t(`order.status.${order.status}` as never)} />
                </td>
                <td className="px-3 py-2.5">{formatMoney(order.grand_total, { locale })}</td>
                <td className="px-3 py-2.5 text-[10px] text-muted">{formatDate(order.created_at, locale, { dateStyle: "medium" })}</td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted">
                  {t("account.noOrders")}
                </td>
              </tr>
            ) : null}
          </AdminTable>
        </section>

        <aside className="space-y-4">
          <section className="border border-line bg-white p-4 text-[12px]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">{t("account.profile")}</h2>
              <Badge tone={user.status === "active" ? "success" : "danger"}>{t(`status.${user.status}` as never)}</Badge>
            </div>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("auth.email")}</dt>
                <dd className="text-right">{user.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("auth.phone")}</dt>
                <dd>{user.phone ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("common.language")}</dt>
                <dd>{user.locale}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("auth.marketing")}</dt>
                <dd>{user.marketing_consent === 1 ? t("common.yes") : t("common.no")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("common.date")}</dt>
                <dd>{formatDate(user.created_at, locale, { dateStyle: "medium" })}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Last login</dt>
                <dd>{user.last_login_at ? formatDateTime(user.last_login_at, locale) : "—"}</dd>
              </div>
            </dl>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{t("account.ordersCount")}</p>
                <p className="font-serif text-lg">{stats?.count ?? 0}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{t("account.totalSpent")}</p>
                <p className="font-serif text-lg">{formatMoney(Number(stats?.spent ?? 0), { locale })}</p>
              </div>
            </div>
          </section>

          <section className="border border-line bg-white p-4 text-[12px]">
            <h2 className="mb-2 text-sm font-medium">{t("account.addresses")}</h2>
            {addresses.length === 0 ? <p className="text-[11px] text-muted">{t("common.empty")}</p> : null}
            <ul className="space-y-2">
              {addresses.map((address) => (
                <li key={address.id} className="border-b border-line pb-2 last:border-0">
                  <p>{address.recipient_name} · {address.phone}</p>
                  <p className="text-[11px] text-muted">
                    {address.address_line} {address.subdistrict} {address.district} {address.province} {address.postal_code}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
