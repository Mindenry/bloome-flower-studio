import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { EmptyState, OrderStatusBadge } from "@/components/ui";
import { IconPackage } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserOrders } from "@/lib/orders";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const orders = await listUserOrders(user.id, 50);

  return (
    <div>
      <h2 className="text-xl">{t("account.orders")}</h2>
      {orders.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={t("account.noOrders")}
            icon={<IconPackage size={28} />}
            action={
              <Link href={`/${locale}/shop`} className="btn btn-primary btn-sm">
                {t("nav.shop")}
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
                <div>
                  <p className="font-mono text-sm">{order.order_number}</p>
                  <p className="text-[11px] text-muted">{formatDate(order.created_at, locale, { dateStyle: "long" })}</p>
                </div>
                <OrderStatusBadge status={order.status} label={t(`order.status.${order.status}` as never)} />
                <div className="text-right">
                  <p className="text-sm">{formatMoney(order.grand_total, { locale })}</p>
                  <p className="text-[11px] text-muted">{t(`payment.status.${order.payment_status}` as never)}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="flex gap-3">
                  {order.items.slice(0, 5).map((item, index) => (
                    <div key={`${item.name_th}-${index}`} className="flex items-center gap-2">
                      <div className="relative h-16 w-12 overflow-hidden bg-[#f1efe8]">
                        {item.image_url ? (
                          <Image src={item.image_url} alt="" fill sizes="48px" className="object-cover" />
                        ) : null}
                      </div>
                      <div className="hidden max-w-[140px] sm:block">
                        <p className="truncate text-xs">{locale === "th" ? item.name_th : item.name_en}</p>
                        <p className="text-[10px] text-muted">× {item.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Link href={`/${locale}/order/${order.order_number}`} className="btn btn-ghost btn-sm">
                    {t("account.orderDetail")}
                  </Link>
                  <Link href={`/${locale}/account/orders/${order.order_number}`} className="btn btn-outline btn-sm">
                    {t("account.reviewCta")}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
