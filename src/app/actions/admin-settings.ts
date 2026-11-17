"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, nowIso } from "@/lib/db";
import { ids } from "@/lib/ids";
import { settingsSchema, type FormState } from "@/lib/schemas";
import { getCurrentUser, can } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { updateSettings, setRawSetting, getRawSetting } from "@/lib/settings";
import type { SlotTemplate } from "@/lib/defaults";
import { asLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { logActivity } from "@/lib/audit";

async function guard(locale: Locale) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!can(user, PERMISSIONS.SETTINGS_MANAGE)) redirect(`/${locale}/admin?denied=1`);
  return user;
}

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale);

  const parsed = settingsSchema.safeParse({
    storeName: formData.get("storeName"),
    storeTagline: formData.get("storeTagline") ?? "",
    storeEmail: formData.get("storeEmail"),
    storePhone: formData.get("storePhone") ?? "",
    storeLineId: formData.get("storeLineId") ?? "",
    storeInstagram: formData.get("storeInstagram") ?? "",
    storeFacebook: formData.get("storeFacebook") ?? "",
    addressTh: formData.get("addressTh") ?? "",
    addressEn: formData.get("addressEn") ?? "",
    hoursTh: formData.get("hoursTh") ?? "",
    hoursEn: formData.get("hoursEn") ?? "",
    logoUrl: formData.get("logoUrl") ?? "",
    faviconUrl: formData.get("faviconUrl") ?? "",
    mapUrl: formData.get("mapUrl") ?? "",
    taxId: formData.get("taxId") ?? "",
    taxRateBp: formData.get("taxRateBp") ?? 700,
    pricesIncludeTax: formData.get("pricesIncludeTax") === "true",
    minOrderTotal: formData.get("minOrderTotal") ?? 0,
    shippingFee: formData.get("shippingFee") ?? 0,
    freeThreshold: formData.get("freeThreshold") ?? 0,
    sameDayEnabled: formData.get("sameDayEnabled") === "true",
    cutoffHour: formData.get("cutoffHour") ?? 14,
    leadDays: formData.get("leadDays") ?? 0,
    maxDaysAhead: formData.get("maxDaysAhead") ?? 30,
    defaultCapacity: formData.get("defaultCapacity") ?? 10,
    closedWeekdays: formData.getAll("closedWeekdays").map((value) => Number(value)),
    paymentMethods: formData.getAll("paymentMethods").map(String),
    promptpayExpiryMinutes: formData.get("promptpayExpiryMinutes") ?? 30,
    codEnabled: formData.get("codEnabled") === "true",
    seoTitleTh: formData.get("seoTitleTh") ?? "",
    seoTitleEn: formData.get("seoTitleEn") ?? "",
    seoDescriptionTh: formData.get("seoDescriptionTh") ?? "",
    seoDescriptionEn: formData.get("seoDescriptionEn") ?? "",
    seoKeywords: formData.get("seoKeywords") ?? "",
    ogImage: formData.get("ogImage") ?? "",
    emailOnOrder: formData.get("emailOnOrder") === "true",
    lineOnOrder: formData.get("lineOnOrder") === "true",
  });

  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation") };
  }
  const data = parsed.data;

  await updateSettings({
    store: {
      name: data.storeName,
      nameEn: data.storeName,
      tagline: data.storeTagline,
      email: data.storeEmail,
      phone: data.storePhone,
      lineId: data.storeLineId ?? "",
      instagram: data.storeInstagram ?? "",
      facebook: data.storeFacebook ?? "",
      addressTh: data.addressTh ?? "",
      addressEn: data.addressEn ?? "",
      hoursTh: data.hoursTh ?? "",
      hoursEn: data.hoursEn ?? "",
      logoUrl: data.logoUrl ?? "",
      faviconUrl: data.faviconUrl ?? "",
      mapUrl: data.mapUrl ?? "",
      taxId: data.taxId ?? "",
    },
    commerce: {
      taxRateBp: data.taxRateBp,
      pricesIncludeTax: data.pricesIncludeTax,
      minOrderTotal: data.minOrderTotal,
      lowStockDefault: 5,
      currency: "THB",
    },
    shipping: {
      fee: data.shippingFee,
      freeThreshold: data.freeThreshold,
      sameDayEnabled: data.sameDayEnabled,
      cutoffHour: data.cutoffHour,
      leadDays: data.leadDays,
      maxDaysAhead: data.maxDaysAhead,
      closedWeekdays: data.closedWeekdays,
      defaultCapacity: data.defaultCapacity,
      deliveryNoteTh: "",
      deliveryNoteEn: "",
    },
    payment: {
      methods: data.paymentMethods.length ? data.paymentMethods : ["bank_transfer"],
      promptpayExpiryMinutes: data.promptpayExpiryMinutes,
      codEnabled: data.codEnabled,
      bankName: "",
      bankAccountName: "",
      bankAccountNumber: "",
    },
    seo: {
      titleTh: data.seoTitleTh,
      titleEn: data.seoTitleEn,
      descriptionTh: data.seoDescriptionTh,
      descriptionEn: data.seoDescriptionEn,
      keywords: data.seoKeywords ?? "",
      ogImage: data.ogImage ?? "",
    },
    notifications: { emailOnOrder: data.emailOnOrder, lineOnOrder: data.lineOnOrder },
  });

  await logActivity({ actor: user, action: "settings.save", entityType: "settings" });
  revalidatePath("/", "layout");
  revalidatePath(`/${locale}/admin/settings`, "page");
  return { ok: true, message: translate(locale, "admin.settingsSaved") };
}

export async function saveSlotTemplatesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale);
  const starts = formData.getAll("slotStart").map(String);
  const ends = formData.getAll("slotEnd").map(String);
  const capacities = formData.getAll("slotCapacity").map((value) => Number(value));

  const templates: SlotTemplate[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = ends[index];
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) continue;
    templates.push({ start, end, capacity: Math.max(1, capacities[index] || 10) });
  }
  if (templates.length === 0) return { ok: false, error: translate(locale, "validation.required") };

  await setRawSetting("shipping.slotTemplates", templates);
  await logActivity({ actor: user, action: "settings.slots", entityType: "settings", meta: { templates } });
  revalidatePath(`/${locale}/admin/settings`);
  revalidatePath(`/${locale}/checkout`);
  return { ok: true, message: translate(locale, "admin.settingsSaved") };
}

export async function blockDateAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guard(locale);
  const date = String(formData.get("date") ?? "");
  const reason = String(formData.get("reason") ?? "").slice(0, 200);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const existing = await db.selectFrom("delivery_blocked_dates").select("id").where("date", "=", date).executeTakeFirst();
  if (existing) {
    await db.updateTable("delivery_blocked_dates").set({ reason: reason || null }).where("id", "=", existing.id).execute();
  } else {
    await db
      .insertInto("delivery_blocked_dates")
      .values({ id: ids.blockDate(), date, reason: reason || null, created_at: nowIso() })
      .execute();
  }
  revalidatePath(`/${locale}/admin/settings`);
  revalidatePath(`/${locale}/checkout`);
}

export async function unblockDateAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guard(locale);
  await db.deleteFrom("delivery_blocked_dates").where("id", "=", String(formData.get("id") ?? "")).execute();
  revalidatePath(`/${locale}/admin/settings`);
  revalidatePath(`/${locale}/checkout`);
}

export async function updateSlotCapacityAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guard(locale);
  const id = String(formData.get("id") ?? "");
  const capacity = Math.max(1, Number(formData.get("capacity") ?? 10));
  await db.updateTable("delivery_slots").set({ capacity, updated_at: nowIso() }).where("id", "=", id).execute();
  revalidatePath(`/${locale}/admin/settings`);
  revalidatePath(`/${locale}/checkout`);
}

export async function toggleSlotStatusAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guard(locale);
  const id = String(formData.get("id") ?? "");
  const row = await db.selectFrom("delivery_slots").select("status").where("id", "=", id).executeTakeFirst();
  if (!row) return;
  await db
    .updateTable("delivery_slots")
    .set({ status: row.status === "open" ? "closed" : "open", updated_at: nowIso() })
    .where("id", "=", id)
    .execute();
  revalidatePath(`/${locale}/admin/settings`);
}

export async function readSlotTemplatesAction(): Promise<SlotTemplate[]> {
  const raw = await getRawSetting("shipping.slotTemplates");
  return raw ? (JSON.parse(raw) as SlotTemplate[]) : [];
}
