"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, nowIso, parseJson } from "@/lib/db";
import { ids } from "@/lib/ids";
import { couponSchema, type FormState } from "@/lib/schemas";
import { getCurrentUser, can } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { asLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { logActivity } from "@/lib/audit";
import { notifyCustomer } from "@/lib/notify";

async function guard(locale: Locale, permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!can(user, permission)) redirect(`/${locale}/admin?denied=1`);
  return user;
}

export async function saveCouponAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.COUPON_MANAGE);
  const parsed = couponSchema.safeParse({
    id: formData.get("id") || undefined,
    code: formData.get("code"),
    descriptionTh: formData.get("descriptionTh") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    type: formData.get("type"),
    value: formData.get("value") || 0,
    minSpend: formData.get("minSpend") || 0,
    maxDiscount: formData.get("maxDiscount") ?? "",
    usageLimit: formData.get("usageLimit") ?? "",
    perCustomerLimit: formData.get("perCustomerLimit") || 1,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt") ?? "",
    status: formData.get("status") || "active",
    appliesTo: formData.get("appliesTo") || "all",
    productIds: formData.get("productIds") ?? "",
    categoryIds: formData.get("categoryIds") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "_form"] = translate(locale, issue.message as never);
    }
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors };
  }
  const data = parsed.data;
  const duplicate = await db
    .selectFrom("coupons")
    .select("id")
    .where("code", "=", data.code)
    .where("id", "!=", data.id ?? "")
    .executeTakeFirst();
  if (duplicate) return { ok: false, error: translate(locale, "error.couponInvalid"), fieldErrors: { code: translate(locale, "error.couponInvalid") } };

  const couponId = data.id ?? ids.coupon();
  const now = nowIso();
  const values = {
    code: data.code,
    description_th: data.descriptionTh || null,
    description_en: data.descriptionEn || null,
    type: data.type,
    value: data.value,
    min_spend: data.minSpend,
    max_discount: typeof data.maxDiscount === "number" ? data.maxDiscount : null,
    usage_limit: typeof data.usageLimit === "number" ? data.usageLimit : null,
    per_customer_limit: data.perCustomerLimit,
    starts_at: new Date(data.startsAt).toISOString(),
    ends_at: data.endsAt ? new Date(data.endsAt).toISOString() : null,
    status: data.status,
    applies_to: data.appliesTo,
    product_ids: data.productIds ? JSON.stringify(data.productIds.split(",").map((value) => value.trim()).filter(Boolean)) : null,
    category_ids: data.categoryIds ? JSON.stringify(data.categoryIds.split(",").map((value) => value.trim()).filter(Boolean)) : null,
    free_shipping: data.type === "free_shipping" ? 1 : 0,
    updated_at: now,
  };

  if (data.id) {
    await db.updateTable("coupons").set(values).where("id", "=", couponId).execute();
  } else {
    await db.insertInto("coupons").values({ id: couponId, ...values, created_at: now }).execute();
  }
  await logActivity({ actor: user, action: data.id ? "coupon.update" : "coupon.create", entityType: "coupon", entityId: couponId });
  revalidatePath(`/${locale}/admin/coupons`);
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function toggleCouponAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guard(locale, PERMISSIONS.COUPON_MANAGE);
  const id = String(formData.get("id") ?? "");
  const coupon = await db.selectFrom("coupons").select("status").where("id", "=", id).executeTakeFirst();
  if (!coupon) return;
  await db
    .updateTable("coupons")
    .set({ status: coupon.status === "active" ? "inactive" : "active", updated_at: nowIso() })
    .where("id", "=", id)
    .execute();
  revalidatePath(`/${locale}/admin/coupons`);
}

export async function deleteCouponAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.COUPON_MANAGE);
  const id = String(formData.get("id") ?? "");
  const used = await db.selectFrom("coupon_usages").select("id").where("coupon_id", "=", id).limit(1).executeTakeFirst();
  if (used) {
    await db.updateTable("coupons").set({ status: "inactive", updated_at: nowIso() }).where("id", "=", id).execute();
  } else {
    await db.deleteFrom("coupons").where("id", "=", id).execute();
  }
  await logActivity({ actor: user, action: "coupon.delete", entityType: "coupon", entityId: id });
  revalidatePath(`/${locale}/admin/coupons`);
}

export async function moderateReviewAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.REVIEW_MODERATE);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["approved", "rejected", "pending"].includes(status)) return;
  await db.updateTable("reviews").set({ status, updated_at: nowIso() }).where("id", "=", id).execute();

  const review = await db.selectFrom("reviews").select(["user_id", "product_id"]).where("id", "=", id).executeTakeFirst();
  if (review && status === "approved") {
    await notifyCustomer(review.user_id, "review_approved", {
      titleTh: "รีวิวของคุณได้รับการเผยแพร่แล้ว",
      titleEn: "Your review is live",
      bodyTh: "ขอบคุณที่แบ่งปันความคิดเห็นกับเรา",
      bodyEn: "Thank you for sharing your experience.",
      linkUrl: `/${locale}/product`,
    }).catch(() => undefined);
  }
  await logActivity({ actor: user, action: `review.${status}`, entityType: "review", entityId: id });
  revalidatePath(`/${locale}/admin/reviews`);
  revalidatePath("/", "layout");
}

export async function replyReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.REVIEW_MODERATE);
  const id = String(formData.get("id") ?? "");
  const reply = String(formData.get("reply") ?? "").trim().slice(0, 1500);
  if (!reply) return { ok: false, error: translate(locale, "validation.required") };
  await db
    .updateTable("reviews")
    .set({ admin_reply: reply, replied_at: nowIso(), updated_at: nowIso() })
    .where("id", "=", id)
    .execute();
  await logActivity({ actor: user, action: "review.reply", entityType: "review", entityId: id });
  revalidatePath(`/${locale}/admin/reviews`);
  revalidatePath("/", "layout");
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function replyReviewFormAction(formData: FormData): Promise<void> {
  await replyReviewAction({ ok: false }, formData);
}

export async function broadcastNotificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.NOTIFICATION_MANAGE);
  const titleTh = String(formData.get("titleTh") ?? "").trim().slice(0, 160);
  const titleEn = String(formData.get("titleEn") ?? "").trim().slice(0, 160);
  const bodyTh = String(formData.get("bodyTh") ?? "").trim().slice(0, 1000);
  const bodyEn = String(formData.get("bodyEn") ?? "").trim().slice(0, 1000);
  const linkUrl = String(formData.get("linkUrl") ?? "").trim().slice(0, 300);
  const audience = String(formData.get("audience") ?? "marketing");

  if (!titleTh || !titleEn) return { ok: false, error: translate(locale, "validation.required") };

  let recipients: Array<{ id: string }> = [];
  if (audience === "marketing") {
    recipients = await db
      .selectFrom("users")
      .select("id")
      .where("marketing_consent", "=", 1)
      .where("status", "=", "active")
      .where("deleted_at", "is", null)
      .execute();
  } else if (audience === "customers") {
    recipients = await db
      .selectFrom("users")
      .select("id")
      .where("role_id", "in", db.selectFrom("roles").select("id").where("slug", "=", "customer"))
      .where("status", "=", "active")
      .where("deleted_at", "is", null)
      .execute();
  }

  for (const recipient of recipients) {
    await notifyCustomer(recipient.id, "broadcast", {
      titleTh,
      titleEn,
      bodyTh,
      bodyEn,
      linkUrl: linkUrl || null,
    });
  }

  await db
    .insertInto("notifications")
    .values({
      id: ids.notification(),
      user_id: null,
      audience: "admin",
      type: "broadcast_sent",
      title_th: titleTh,
      title_en: titleEn,
      body_th: `Sent to ${recipients.length} customers`,
      body_en: `Sent to ${recipients.length} customers`,
      link_url: null,
      read_at: null,
      created_at: nowIso(),
    })
    .execute()
    .catch(() => undefined);

  await logActivity({ actor: user, action: "notification.broadcast", entityType: "notification", meta: { recipients: recipients.length, audience } });
  revalidatePath(`/${locale}/admin/notifications`);
  return { ok: true, message: `${translate(locale, "common.saved")} · ${recipients.length}` };
}

export async function markAdminNotificationsReadAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guard(locale, PERMISSIONS.DASHBOARD_VIEW);
  await db.updateTable("notifications").set({ read_at: nowIso() }).where("audience", "=", "admin").where("read_at", "is", null).execute();
  revalidatePath(`/${locale}/admin/notifications`);
}

export async function markCouponBulkAction(formData: FormData): Promise<void> {
  void parseJson;
  await toggleCouponAction(formData);
}
