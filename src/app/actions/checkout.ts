"use server";

import { redirect } from "next/navigation";
import { checkoutSchema, type FormState } from "@/lib/schemas";
import { placeOrder, CheckoutError } from "@/lib/checkout";
import { initiatePayment } from "@/lib/payments";
import { getCurrentUser, getOrCreateGuestToken, requestMeta } from "@/lib/auth/session";
import { findActiveCart, getCart } from "@/lib/cart";
import { asLocale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { sendOrderCreatedEmail } from "@/lib/email";
import { notifyAdmins } from "@/lib/notify";
import { logActivity } from "@/lib/audit";

export async function placeOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const raw = {
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    recipientName: formData.get("recipientName"),
    recipientPhone: formData.get("recipientPhone"),
    addressLine: formData.get("addressLine"),
    subdistrict: formData.get("subdistrict"),
    district: formData.get("district"),
    province: formData.get("province"),
    postalCode: formData.get("postalCode"),
    deliveryNotes: formData.get("deliveryNotes") ?? "",
    deliveryDate: formData.get("deliveryDate"),
    slotStart: formData.get("slotStart"),
    slotEnd: formData.get("slotEnd"),
    giftMessage: formData.get("giftMessage") ?? "",
    senderName: formData.get("senderName") ?? "",
    anonymous: formData.get("anonymous") === "1",
    cardDesign: formData.get("cardDesign") ?? "classic",
    customerNote: formData.get("customerNote") ?? "",
    paymentMethod: formData.get("paymentMethod"),
    acceptTerms: formData.get("acceptTerms") === "true",
    idempotencyKey: formData.get("idempotencyKey"),
  };

  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      fieldErrors[key] = translate(locale, issue.message as never);
    }
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors };
  }

  const user = await getCurrentUser();
  const guestToken = user ? null : await getOrCreateGuestToken();
  const cart = await findActiveCart(user?.id ?? null, guestToken);
  if (!cart) return { ok: false, error: translate(locale, "error.cartEmpty") };

  const cartView = await getCart(locale);
  if (cartView.hasBlockingIssues) {
    return { ok: false, error: translate(locale, "cart.outOfStockWarning") };
  }

  const meta = await requestMeta();
  let result;
  try {
    result = await placeOrder(parsed.data, {
      userId: user?.id ?? null,
      guestToken,
      locale,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return {
        ok: false,
        error: translate(locale, error.code as never),
        fieldErrors: error.field ? { [error.field]: translate(locale, error.code as never) } : undefined,
      };
    }
    console.error("[checkout] failed", error);
    return { ok: false, error: translate(locale, "error.server") };
  }

  // Provider call happens after the order commits: a provider outage never loses the order.
  const initiated = await initiatePayment(result.paymentId).catch(() => ({ ok: false as const }));

  if (!result.reused) {
    await Promise.all([
      sendOrderCreatedEmail({
        to: parsed.data.email,
        locale,
        name: parsed.data.contactName,
        orderNumber: result.orderNumber,
        total: result.grandTotal,
        paymentMethod: result.paymentMethod,
        deliveryDate: parsed.data.deliveryDate,
        deliverySlot: `${parsed.data.slotStart} – ${parsed.data.slotEnd}`,
      }).catch(() => undefined),
      notifyAdmins("new_order", {
        titleTh: "มีคำสั่งซื้อใหม่",
        titleEn: "New order received",
        bodyTh: `${result.orderNumber} · ฿${(result.grandTotal / 100).toLocaleString("th-TH")}`,
        bodyEn: `${result.orderNumber} · THB ${(result.grandTotal / 100).toLocaleString("en-US")}`,
        linkUrl: `/${locale}/admin/orders`,
      }).catch(() => undefined),
      logActivity({
        actor: user,
        actorEmail: parsed.data.email,
        action: "order.create",
        entityType: "order",
        entityId: result.orderId,
        meta: { orderNumber: result.orderNumber, total: result.grandTotal },
        ip: meta.ip,
      }),
    ]);
  }

  void initiated;
  redirect(`/${locale}/order/${result.orderNumber}?placed=1`);
}
