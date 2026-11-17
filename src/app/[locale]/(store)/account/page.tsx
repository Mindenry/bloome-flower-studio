import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Alert, OrderStatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { listUserOrders } from "@/lib/orders";
import { getWishlistIds } from "@/lib/cart";
import { resendVerificationAction } from "@/app/actions/auth";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const [orders, spentRow, reminderRow, wishlistIds] = await Promise.all([
    listUserOrders(user.id, 4),
    db
      .selectFrom("orders")
      .select(({ fn }) => fn.sum<number>("grand_total").as("total"))
      .where("user_id", "=", user.id)
      .where("payment_status", "=", "succeeded")
      .executeTakeFirst(),
    db
      .selectFrom("occasion_reminders")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("user_id", "=", user.id)
      .where("active", "=", 1)
      .executeTakeFirst(),
    getWishlistIds(user.id),
  ]);

  const orderCountRow = await db
    .selectFrom("orders")
    .select(({ fn }) => fn.countAll<string>().as("count"))
    .where("user_id", "=", user.id)
    .executeTakeFirst();

  return (
    <div className="space-y-8">
      {!user.emailVerifiedAt && user.email ? (
        <Alert tone="warning" title={t("auth.verify.title")}>
          <p>{t("auth.emailUnverified")}</p>
          <form action={resendVerificationAction} className="mt-2">
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="text-xs underline underline-offset-4">
              {t("auth.verify.resend")}
            </button>
          </form>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t("account.ordersCount"), value: String(orderCountRow?.count ?? 0), href: `/${locale}/account/orders` },
          { label: t("account.totalSpent"), value: formatMoney(Number(spentRow?.total ?? 0), { locale }), href: `/${locale}/account/orders` },
          { label: t("account.activeReminders"), value: String(reminderRow?.count ?? 0), href: `/${locale}/account/reminders` },
          { label: t("account.wishlist"), value: String(wishlistIds.length), href: `/${locale}/account/wishlist` },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} className="card p-5 transition-colors hover:border-primary">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{stat.label}</p>
            <p className="mt-2 font-serif text-2xl">{stat.value}</p>
          </Link>
        ))}
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl">{t("account.orders")}</h2>
          <Link href={`/${locale}/account/orders`} className="text-xs uppercase tracking-[0.14em] text-primary-dark">
            {t("common.viewAll")}
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="mt-3 border border-line bg-white px-5 py-8 text-sm text-muted">{t("account.noOrders")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((order) => (
              <li key={order.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm">{order.order_number}</p>
                    <p className="text-[11px] text-muted">{formatDate(order.created_at, locale, { dateStyle: "medium" })}</p>
                  </div>
                  <OrderStatusBadge status={order.status} label={t(`order.status.${order.status}` as never)} />
                  <p className="text-sm">{formatMoney(order.grand_total, { locale })}</p>
                  <Link href={`/${locale}/order/${order.order_number}`} className="btn btn-ghost btn-sm">
                    {t("account.orderDetail")}
                  </Link>
                </div>
                <div className="mt-3 flex gap-2">
                  {order.items.slice(0, 4).map((item, index) => (
                    <div key={`${item.name_th}-${index}`} className="relative h-14 w-11 overflow-hidden bg-[#f1efe8]">
                      {item.image_url ? (
                        <Image src={item.image_url} alt="" fill sizes="44px" className="object-cover" />
                      ) : null}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { href: `/${locale}/account/reminders`, label: t("account.reminders") },
          { href: `/${locale}/account/recipients`, label: t("account.recipients") },
          { href: `/${locale}/flower-finder`, label: t("finder.title") },
        ].map((link) => (
          <Link key={link.href} href={link.href} className="border border-line bg-white px-4 py-3 text-sm hover:border-primary">
            {link.label} →
          </Link>
        ))}
      </section>
    </div>
  );
}
