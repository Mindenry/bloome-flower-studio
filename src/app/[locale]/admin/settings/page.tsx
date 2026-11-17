import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/ui";
import { SettingsForm, SlotTemplatesForm } from "@/components/admin/settings-form";
import { Badge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { getSettings, getRawSetting } from "@/lib/settings";
import { DEFAULT_SLOT_TEMPLATES, type SlotTemplate } from "@/lib/defaults";
import { integrationStatus } from "@/lib/env";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { addDaysToDateString, bangkokDateString } from "@/lib/time";
import { blockDateAction, toggleSlotStatusAction, unblockDateAction, updateSlotCapacityAction } from "@/app/actions/admin-settings";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.SETTINGS_MANAGE);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const [settings, rawTemplates, blocked, upcoming, integrations] = await Promise.all([
    getSettings(),
    getRawSetting("shipping.slotTemplates"),
    db.selectFrom("delivery_blocked_dates").selectAll().orderBy("date", "asc").execute(),
    db
      .selectFrom("delivery_slots")
      .selectAll()
      .where("date", ">=", bangkokDateString())
      .where("date", "<=", addDaysToDateString(bangkokDateString(), 30))
      .orderBy("date", "asc")
      .orderBy("start_time", "asc")
      .execute(),
    Promise.resolve(integrationStatus()),
  ]);

  const templates: SlotTemplate[] = rawTemplates ? (JSON.parse(rawTemplates) as SlotTemplate[]) : DEFAULT_SLOT_TEMPLATES;

  return (
    <div>
      <AdminPageHeader title={t("admin.settings")} description={locale === "th" ? "ข้อมูลร้าน การจัดส่ง การชำระเงิน และ SEO" : "Store, delivery, payment and SEO configuration."} />

      <section className="mb-5 border border-line bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">{t("admin.configurationRequired")}</h2>
        <div className="grid gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "LINE Login", ready: integrations.lineLogin },
            { label: "LINE Messaging", ready: integrations.lineMessaging },
            { label: "Google Login", ready: integrations.googleLogin },
            { label: `Payments (${integrations.paymentProvider})`, ready: integrations.paymentConfigured },
            { label: "Email", ready: integrations.email },
            { label: `Storage (${integrations.storage})`, ready: integrations.storageConfigured },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between border border-line px-3 py-2">
              <span>{item.label}</span>
              <Badge tone={item.ready ? "success" : "warning"}>{item.ready ? "READY" : "CONFIGURE"}</Badge>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          {locale === "th"
            ? "ค่าความลับ (Secret) ตั้งค่าใน .env เท่านั้น ไม่แสดงบนหน้าจอนี้"
            : "Secrets live only in .env and are never rendered here."}
        </p>
      </section>

      <SettingsForm
        locale={locale}
        values={{
          storeName: settings.store.name,
          storeTagline: settings.store.tagline,
          storeEmail: settings.store.email,
          storePhone: settings.store.phone,
          storeLineId: settings.store.lineId,
          storeInstagram: settings.store.instagram,
          storeFacebook: settings.store.facebook,
          addressTh: settings.store.addressTh,
          addressEn: settings.store.addressEn,
          hoursTh: settings.store.hoursTh,
          hoursEn: settings.store.hoursEn,
          logoUrl: settings.store.logoUrl,
          faviconUrl: settings.store.faviconUrl,
          mapUrl: settings.store.mapUrl,
          taxId: settings.store.taxId,
          taxRateBp: settings.commerce.taxRateBp,
          pricesIncludeTax: settings.commerce.pricesIncludeTax,
          minOrderTotal: settings.commerce.minOrderTotal,
          shippingFee: settings.shipping.fee,
          freeThreshold: settings.shipping.freeThreshold,
          sameDayEnabled: settings.shipping.sameDayEnabled,
          cutoffHour: settings.shipping.cutoffHour,
          leadDays: settings.shipping.leadDays,
          maxDaysAhead: settings.shipping.maxDaysAhead,
          defaultCapacity: settings.shipping.defaultCapacity,
          closedWeekdays: settings.shipping.closedWeekdays,
          paymentMethods: settings.payment.methods,
          promptpayExpiryMinutes: settings.payment.promptpayExpiryMinutes,
          codEnabled: settings.payment.codEnabled,
          seoTitleTh: settings.seo.titleTh,
          seoTitleEn: settings.seo.titleEn,
          seoDescriptionTh: settings.seo.descriptionTh,
          seoDescriptionEn: settings.seo.descriptionEn,
          seoKeywords: settings.seo.keywords,
          ogImage: settings.seo.ogImage,
          emailOnOrder: settings.notifications.emailOnOrder,
          lineOnOrder: settings.notifications.lineOnOrder,
        }}
      />

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <section className="border border-line bg-white p-4">
          <h2 className="text-sm font-medium">{t("admin.slot")}</h2>
          <p className="mt-1 text-[11px] text-muted">
            {locale === "th" ? "ช่วงเวลาจัดส่งมาตรฐาน (ใช้สร้างช่องเวลาแบบเรียลไทม์)" : "Default delivery windows (materialised on booking)."}
          </p>
          <div className="mt-3">
            <SlotTemplatesForm locale={locale} templates={templates} />
          </div>
        </section>

        <section className="border border-line bg-white p-4">
          <h2 className="text-sm font-medium">{t("admin.blockedDates")}</h2>
          <form action={blockDateAction} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="locale" value={locale} />
            <input type="date" name="date" required className="input h-9 w-auto text-xs" />
            <input name="reason" placeholder={t("common.optionalNote")} className="input h-9 flex-1 text-xs" />
            <button type="submit" className="btn btn-primary btn-sm">
              {t("common.create")}
            </button>
          </form>
          <ul className="mt-3 divide-y divide-line text-[12px]">
            {blocked.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2">
                <span>
                  {item.date} <span className="text-[10px] text-muted">{item.reason}</span>
                </span>
                <form action={unblockDateAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="text-[10px] text-danger underline underline-offset-2">
                    {t("common.delete")}
                  </button>
                </form>
              </li>
            ))}
            {blocked.length === 0 ? <li className="py-2 text-[11px] text-muted">{t("common.empty")}</li> : null}
          </ul>
        </section>
      </div>

      <section className="mt-5 border border-line bg-white">
        <h2 className="border-b border-line px-4 py-3 text-sm font-medium">
          {t("admin.slot")} · {locale === "th" ? "ความจุที่ถูกจองแล้ว" : "Booked capacity"}
        </h2>
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-[#faf9f5] text-left text-[9px] uppercase tracking-[0.1em] text-muted">
              <tr>
                <th className="px-4 py-2">{t("common.date")}</th>
                <th className="px-4 py-2">{t("admin.slot")}</th>
                <th className="px-4 py-2">{t("admin.booked")}</th>
                <th className="px-4 py-2">{t("admin.capacity")}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {upcoming.map((slot) => (
                <tr key={slot.id}>
                  <td className="px-4 py-2">{slot.date}</td>
                  <td className="px-4 py-2">
                    {slot.start_time} – {slot.end_time}
                  </td>
                  <td className="px-4 py-2">{slot.booked_count}</td>
                  <td className="px-4 py-2">
                    <form action={updateSlotCapacityAction} className="flex items-center gap-1">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={slot.id} />
                      <input name="capacity" type="number" min={1} defaultValue={slot.capacity} className="input h-6 w-16 px-1 text-[10px]" />
                      <button type="submit" className="text-[9px] text-primary-dark underline underline-offset-2">
                        {t("common.save")}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-2">
                    <form action={toggleSlotStatusAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={slot.id} />
                      <button type="submit" className="text-[9px] text-muted underline underline-offset-2">
                        {slot.status}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {upcoming.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[11px] text-muted">
                    {t("common.empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
