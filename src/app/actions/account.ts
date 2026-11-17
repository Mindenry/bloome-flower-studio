"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, nowIso } from "@/lib/db";
import { ids } from "@/lib/ids";
import { getCurrentUser, destroyCurrentSession, revokeAllSessions } from "@/lib/auth/session";
import { changePassword, deleteAccount } from "@/lib/auth/service";
import { unlinkProvider } from "@/lib/auth/oauth";
import {
  addressSchema,
  changePasswordSchema,
  profileSchema,
  recipientSchema,
  reminderSchema,
  reviewSchema,
  type FormState,
} from "@/lib/schemas";
import { asLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { toggleWishlist } from "@/lib/cart";
import { notifyAdmins } from "@/lib/notify";
import { logActivity } from "@/lib/audit";

async function currentUserOrThrow(locale: Locale) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`);
  return user;
}

function fieldErrors(locale: Locale, issues: Array<{ path: (string | number)[]; message: string }>) {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_form";
    result[key] = translate(locale, issue.message as never);
  }
  return result;
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    locale: formData.get("locale"),
    marketingConsent: formData.get("marketingConsent") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors: fieldErrors(locale, parsed.error.issues) };
  }
  await db
    .updateTable("users")
    .set({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      locale: parsed.data.locale,
      marketing_consent: parsed.data.marketingConsent ? 1 : 0,
      updated_at: nowIso(),
    })
    .where("id", "=", user.id)
    .execute();
  revalidatePath(`/${locale}/account`);
  revalidatePath(`/${locale}/account/profile`);
  return { ok: true, message: translate(locale, "account.profileSaved") };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors: fieldErrors(locale, parsed.error.issues) };
  }
  const result = await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword, user.sessionId);
  if (!result.ok) return { ok: false, error: translate(locale, (result.error ?? "error.generic") as never) };
  await logActivity({ actor: user, action: "account.change_password", entityType: "user", entityId: user.id });
  return { ok: true, message: translate(locale, "account.passwordChanged") };
}

export async function revokeOtherSessionsAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  await revokeAllSessions(user.id, user.sessionId);
  redirect(`/${locale}/account/security?revoked=1`);
}

export async function deleteMyAccountAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  const confirmation = String(formData.get("confirmation") ?? "");
  if (confirmation !== "DELETE") redirect(`/${locale}/account/security?deleteError=1`);
  await deleteAccount(user.id);
  await destroyCurrentSession();
  redirect(`/${locale}?deleted=1`);
}

export async function saveAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  const parsed = addressSchema.safeParse({
    id: formData.get("id") || undefined,
    label: formData.get("label") || "home",
    recipientName: formData.get("recipientName"),
    phone: formData.get("phone"),
    addressLine: formData.get("addressLine"),
    subdistrict: formData.get("subdistrict"),
    district: formData.get("district"),
    province: formData.get("province"),
    postalCode: formData.get("postalCode"),
    isDefault: formData.get("isDefault") === "true",
  });
  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors: fieldErrors(locale, parsed.error.issues) };
  }
  const now = nowIso();
  if (parsed.data.isDefault) {
    await db.updateTable("addresses").set({ is_default: 0 }).where("user_id", "=", user.id).execute();
  }
  if (parsed.data.id) {
    const existing = await db
      .selectFrom("addresses")
      .select("id")
      .where("id", "=", parsed.data.id)
      .where("user_id", "=", user.id)
      .executeTakeFirst();
    if (!existing) return { ok: false, error: translate(locale, "common.notFound") };
    await db
      .updateTable("addresses")
      .set({
        label: parsed.data.label,
        recipient_name: parsed.data.recipientName,
        phone: parsed.data.phone,
        address_line: parsed.data.addressLine,
        subdistrict: parsed.data.subdistrict,
        district: parsed.data.district,
        province: parsed.data.province,
        postal_code: parsed.data.postalCode,
        is_default: parsed.data.isDefault ? 1 : 0,
        updated_at: now,
      })
      .where("id", "=", parsed.data.id)
      .execute();
  } else {
    await db
      .insertInto("addresses")
      .values({
        id: ids.address(),
        user_id: user.id,
        label: parsed.data.label,
        recipient_name: parsed.data.recipientName,
        phone: parsed.data.phone,
        address_line: parsed.data.addressLine,
        subdistrict: parsed.data.subdistrict,
        district: parsed.data.district,
        province: parsed.data.province,
        postal_code: parsed.data.postalCode,
        country: "TH",
        is_default: parsed.data.isDefault ? 1 : 0,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .execute();
  }
  revalidatePath(`/${locale}/account/addresses`);
  revalidatePath(`/${locale}/checkout`);
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  const id = String(formData.get("id") ?? "");
  await db
    .updateTable("addresses")
    .set({ deleted_at: nowIso() })
    .where("id", "=", id)
    .where("user_id", "=", user.id)
    .execute();
  revalidatePath(`/${locale}/account/addresses`);
}

export async function saveRecipientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  const parsed = recipientSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    phone: formData.get("phone"),
    addressLine: formData.get("addressLine"),
    subdistrict: formData.get("subdistrict"),
    district: formData.get("district"),
    province: formData.get("province"),
    postalCode: formData.get("postalCode"),
    note: formData.get("note") ?? "",
    birthday: formData.get("birthday") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors: fieldErrors(locale, parsed.error.issues) };
  }
  const now = nowIso();
  if (parsed.data.id) {
    await db
      .updateTable("recipients")
      .set({
        name: parsed.data.name,
        phone: parsed.data.phone,
        address_line: parsed.data.addressLine,
        subdistrict: parsed.data.subdistrict,
        district: parsed.data.district,
        province: parsed.data.province,
        postal_code: parsed.data.postalCode,
        note: parsed.data.note || null,
        birthday: parsed.data.birthday || null,
        updated_at: now,
      })
      .where("id", "=", parsed.data.id)
      .where("user_id", "=", user.id)
      .execute();
  } else {
    await db
      .insertInto("recipients")
      .values({
        id: ids.recipient(),
        user_id: user.id,
        name: parsed.data.name,
        phone: parsed.data.phone,
        address_line: parsed.data.addressLine,
        subdistrict: parsed.data.subdistrict,
        district: parsed.data.district,
        province: parsed.data.province,
        postal_code: parsed.data.postalCode,
        note: parsed.data.note || null,
        birthday: parsed.data.birthday || null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .execute();
  }
  revalidatePath(`/${locale}/account/recipients`);
  return { ok: true, message: translate(locale, "account.recipientSaved") };
}

export async function deleteRecipientAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  const id = String(formData.get("id") ?? "");
  await db
    .updateTable("recipients")
    .set({ deleted_at: nowIso() })
    .where("id", "=", id)
    .where("user_id", "=", user.id)
    .execute();
  revalidatePath(`/${locale}/account/recipients`);
}

export async function saveReminderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  const parsed = reminderSchema.safeParse({
    id: formData.get("id") || undefined,
    recipientName: formData.get("recipientName"),
    occasion: formData.get("occasion"),
    eventDate: formData.get("eventDate"),
    remindDaysBefore: formData.get("remindDaysBefore") ?? 7,
    notifyEmail: formData.get("notifyEmail") === "true",
    notifyLine: formData.get("notifyLine") === "true",
    note: formData.get("note") ?? "",
    active: formData.get("active") !== "false",
  });
  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors: fieldErrors(locale, parsed.error.issues) };
  }
  const now = nowIso();
  if (parsed.data.id) {
    await db
      .updateTable("occasion_reminders")
      .set({
        recipient_name: parsed.data.recipientName,
        occasion: parsed.data.occasion,
        event_date: parsed.data.eventDate,
        remind_days_before: parsed.data.remindDaysBefore,
        notify_email: parsed.data.notifyEmail ? 1 : 0,
        notify_line: parsed.data.notifyLine ? 1 : 0,
        note: parsed.data.note || null,
        active: parsed.data.active ? 1 : 0,
        updated_at: now,
      })
      .where("id", "=", parsed.data.id)
      .where("user_id", "=", user.id)
      .execute();
  } else {
    await db
      .insertInto("occasion_reminders")
      .values({
        id: ids.reminder(),
        user_id: user.id,
        recipient_name: parsed.data.recipientName,
        occasion: parsed.data.occasion,
        event_date: parsed.data.eventDate,
        remind_days_before: parsed.data.remindDaysBefore,
        notify_email: parsed.data.notifyEmail ? 1 : 0,
        notify_line: parsed.data.notifyLine ? 1 : 0,
        note: parsed.data.note || null,
        active: parsed.data.active ? 1 : 0,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }
  revalidatePath(`/${locale}/account/reminders`);
  return { ok: true, message: translate(locale, "account.reminderSaved") };
}

export async function deleteReminderAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  const id = String(formData.get("id") ?? "");
  await db.deleteFrom("occasion_reminders").where("id", "=", id).where("user_id", "=", user.id).execute();
  revalidatePath(`/${locale}/account/reminders`);
}

export async function markNotificationsReadAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  await db
    .updateTable("notifications")
    .set({ read_at: nowIso() })
    .where("user_id", "=", user.id)
    .where("read_at", "is", null)
    .execute();
  revalidatePath(`/${locale}/account/notifications`);
  revalidatePath("/", "layout");
}

export async function toggleWishlistAccountAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  const productId = String(formData.get("productId") ?? "");
  if (productId) await toggleWishlist(user.id, productId);
  revalidatePath(`/${locale}/account/wishlist`);
  revalidatePath(`/${locale}/wishlist`);
}

export async function unlinkProviderAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  const provider = String(formData.get("provider") ?? "");
  if (provider === "line" || provider === "google") {
    await unlinkProvider(user.id, provider);
  }
  revalidatePath(`/${locale}/account/security`);
}

export async function submitReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await currentUserOrThrow(locale);
  const parsed = reviewSchema.safeParse({
    orderItemId: formData.get("orderItemId"),
    rating: formData.get("rating"),
    title: formData.get("title") ?? "",
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors: fieldErrors(locale, parsed.error.issues) };
  }

  const item = await db
    .selectFrom("order_items")
    .innerJoin("orders", "orders.id", "order_items.order_id")
    .select([
      "order_items.id",
      "order_items.product_id",
      "order_items.order_id",
      "orders.user_id",
      "orders.status",
    ])
    .where("order_items.id", "=", parsed.data.orderItemId)
    .executeTakeFirst();

  if (!item || item.user_id !== user.id) return { ok: false, error: translate(locale, "error.forbidden") };
  if (item.status !== "delivered") return { ok: false, error: translate(locale, "review.onlyPurchased") };
  if (!item.product_id) return { ok: false, error: translate(locale, "error.generic") };

  const existing = await db
    .selectFrom("reviews")
    .select("id")
    .where("order_item_id", "=", item.id)
    .executeTakeFirst();
  if (existing) return { ok: false, error: translate(locale, "review.already") };

  await db
    .insertInto("reviews")
    .values({
      id: ids.review(),
      product_id: item.product_id,
      user_id: user.id,
      order_item_id: item.id,
      order_id: item.order_id,
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body,
      status: "pending",
      admin_reply: null,
      replied_at: null,
      verified: 1,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .execute();

  await notifyAdmins("review_pending", {
    titleTh: "มีรีวิวใหม่รอการอนุมัติ",
    titleEn: "New review awaiting moderation",
    bodyTh: `คะแนน ${parsed.data.rating}/5`,
    bodyEn: `Rating ${parsed.data.rating}/5`,
    linkUrl: `/${locale}/admin/reviews`,
  });

  const orderItem = await db
    .selectFrom("order_items")
    .select("order_id")
    .where("id", "=", item.id)
    .executeTakeFirst();
  const order = orderItem
    ? await db.selectFrom("orders").select("order_number").where("id", "=", orderItem.order_id).executeTakeFirst()
    : null;

  revalidatePath(`/${locale}/account/orders`);
  if (order) revalidatePath(`/${locale}/account/orders/${order.order_number}`);
  revalidatePath(`/${locale}/product`);
  return { ok: true, message: translate(locale, "review.pending") };
}
