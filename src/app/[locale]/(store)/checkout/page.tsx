import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import { getCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { getDeliveryCalendar } from "@/lib/delivery";
import { paymentMethodsForStore } from "@/lib/payments";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const [cart, user, settings, methods] = await Promise.all([
    getCart(locale),
    getCurrentUser(),
    getSettings(),
    paymentMethodsForStore(),
  ]);

  if (cart.items.length === 0) redirect(`/${locale}/cart`);
  if (cart.hasBlockingIssues) redirect(`/${locale}/cart`);

  const [days, addresses] = await Promise.all([
    getDeliveryCalendar(locale),
    user
      ? db
          .selectFrom("addresses")
          .selectAll()
          .where("user_id", "=", user.id)
          .where("deleted_at", "is", null)
          .orderBy("is_default", "desc")
          .execute()
      : Promise.resolve([]),
  ]);

  return (
    <div className="container-page py-10 md:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{locale === "th" ? "ขั้นตอนที่ 2 จาก 3" : "Step 2 of 3"}</p>
          <h1 className="mt-2 text-[32px] leading-tight">{t("checkout.title")}</h1>
        </div>
        <Link href={`/${locale}/cart`} className="text-xs uppercase tracking-[0.16em] text-muted hover:text-primary-dark">
          ← {t("nav.cart")}
        </Link>
      </div>

      {!user ? (
        <p className="mb-6 border border-line bg-white px-4 py-3 text-xs text-muted">
          {t("checkout.loginPrompt")}{" "}
          <Link href={`/${locale}/login?next=${encodeURIComponent(`/${locale}/checkout`)}`} className="text-primary-dark underline underline-offset-2">
            {t("nav.login")}
          </Link>
        </p>
      ) : null}

      <CheckoutForm
        locale={locale}
        days={days}
        methods={methods.map((method) => ({ id: method.id, labelKey: method.labelKey, available: method.available }))}
        bank={{
          name: settings.payment.bankName,
          accountNumber: settings.payment.bankAccountNumber,
          accountName: settings.payment.bankAccountName,
        }}
        savedAddresses={addresses.map((address) => ({
          id: address.id,
          label: address.label,
          recipientName: address.recipient_name,
          phone: address.phone,
          addressLine: address.address_line,
          subdistrict: address.subdistrict,
          district: address.district,
          province: address.province,
          postalCode: address.postal_code,
        }))}
        defaults={{
          name: user?.name ?? "",
          email: user?.email ?? "",
          phone: user?.phone ?? "",
        }}
        summary={{
          items: cart.items.map((item) => ({
            name: item.name,
            variantName: item.variantName,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
            addons: item.addons.map((addon) => addon.name),
          })),
          subtotal: cart.totals.subtotal,
          addonsTotal: cart.totals.addonsTotal,
          discountTotal: cart.totals.discountTotal,
          shippingTotal: cart.totals.shippingTotal,
          grandTotal: cart.totals.grandTotal,
          couponCode: cart.coupon?.code ?? null,
        }}
      />
    </div>
  );
}
