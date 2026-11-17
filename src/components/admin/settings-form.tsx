"use client";

import { useActionState, useState } from "react";
import { saveSettingsAction, saveSlotTemplatesAction } from "@/app/actions/admin-settings";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "../i18n-provider";
import { IconPlus, IconTrash } from "../icons";

const initial: FormState = { ok: false };

export type SettingsFormValues = {
  storeName: string;
  storeTagline: string;
  storeEmail: string;
  storePhone: string;
  storeLineId: string;
  storeInstagram: string;
  storeFacebook: string;
  addressTh: string;
  addressEn: string;
  hoursTh: string;
  hoursEn: string;
  logoUrl: string;
  faviconUrl: string;
  mapUrl: string;
  taxId: string;
  taxRateBp: number;
  pricesIncludeTax: boolean;
  minOrderTotal: number;
  shippingFee: number;
  freeThreshold: number;
  sameDayEnabled: boolean;
  cutoffHour: number;
  leadDays: number;
  maxDaysAhead: number;
  defaultCapacity: number;
  closedWeekdays: number[];
  paymentMethods: string[];
  promptpayExpiryMinutes: number;
  codEnabled: boolean;
  seoTitleTh: string;
  seoTitleEn: string;
  seoDescriptionTh: string;
  seoDescriptionEn: string;
  seoKeywords: string;
  ogImage: string;
  emailOnOrder: boolean;
  lineOnOrder: boolean;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-line bg-white p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function SettingsForm({ locale, values }: { locale: string; values: SettingsFormValues }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveSettingsAction, initial);
  const [tab, setTab] = useState<"store" | "commerce" | "delivery" | "payment" | "seo">("store");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-wrap gap-1 border border-line bg-white p-1">
        {[
          { key: "store", label: locale === "th" ? "ข้อมูลร้าน" : "Store" },
          { key: "commerce", label: locale === "th" ? "การค้าและภาษี" : "Commerce & tax" },
          { key: "delivery", label: locale === "th" ? "การจัดส่ง" : "Delivery" },
          { key: "payment", label: locale === "th" ? "การชำระเงิน" : "Payment" },
          { key: "seo", label: "SEO" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as typeof tab)}
            className={`px-3 py-1.5 text-[11px] ${tab === item.key ? "bg-[#24261f] text-white" : "text-muted hover:bg-cream"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {state.error ? <p className="border border-[#f0d6d0] bg-[#fdf0ed] px-4 py-2.5 text-xs text-danger">{state.error}</p> : null}
      {state.ok ? <p className="border border-[#d7e6da] bg-[#eef5f0] px-4 py-2.5 text-xs text-success">{state.message}</p> : null}

      <div className={tab === "store" ? "space-y-4" : "hidden"}>
        <Section title={locale === "th" ? "ข้อมูลร้าน" : "Store information"}>
          <div>
            <label className="label" htmlFor="storeName">Store name *</label>
            <input id="storeName" name="storeName" defaultValue={values.storeName} required className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="storeTagline">Tagline</label>
            <input id="storeTagline" name="storeTagline" defaultValue={values.storeTagline} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="storeEmail">Email *</label>
            <input id="storeEmail" name="storeEmail" type="email" defaultValue={values.storeEmail} required className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="storePhone">Phone</label>
            <input id="storePhone" name="storePhone" defaultValue={values.storePhone} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="storeLineId">LINE ID</label>
            <input id="storeLineId" name="storeLineId" defaultValue={values.storeLineId} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="storeInstagram">Instagram</label>
            <input id="storeInstagram" name="storeInstagram" defaultValue={values.storeInstagram} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="storeFacebook">Facebook</label>
            <input id="storeFacebook" name="storeFacebook" defaultValue={values.storeFacebook} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="taxId">Tax ID</label>
            <input id="taxId" name="taxId" defaultValue={values.taxId} className="input h-9 text-xs" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="addressTh">Address (TH)</label>
            <input id="addressTh" name="addressTh" defaultValue={values.addressTh} className="input h-9 text-xs" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="addressEn">Address (EN)</label>
            <input id="addressEn" name="addressEn" defaultValue={values.addressEn} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="hoursTh">Hours (TH)</label>
            <input id="hoursTh" name="hoursTh" defaultValue={values.hoursTh} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="hoursEn">Hours (EN)</label>
            <input id="hoursEn" name="hoursEn" defaultValue={values.hoursEn} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="logoUrl">Logo URL</label>
            <input id="logoUrl" name="logoUrl" defaultValue={values.logoUrl} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="faviconUrl">Favicon URL</label>
            <input id="faviconUrl" name="faviconUrl" defaultValue={values.faviconUrl} className="input h-9 text-xs" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="mapUrl">Map URL</label>
            <input id="mapUrl" name="mapUrl" defaultValue={values.mapUrl} className="input h-9 text-xs" />
          </div>
        </Section>
      </div>

      <div className={tab === "commerce" ? "space-y-4" : "hidden"}>
        <Section title={locale === "th" ? "การค้าและภาษี" : "Commerce & tax"}>
          <div>
            <label className="label" htmlFor="taxRateBp">VAT (basis points)</label>
            <input id="taxRateBp" name="taxRateBp" type="number" min={0} max={3000} defaultValue={values.taxRateBp} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="minOrderTotal">Min order (satang)</label>
            <input id="minOrderTotal" name="minOrderTotal" type="number" min={0} defaultValue={values.minOrderTotal} className="input h-9 text-xs" />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="pricesIncludeTax" value="true" defaultChecked={values.pricesIncludeTax} className="accent-[#81917B]" />
            {locale === "th" ? "ราคาสินค้ารวมภาษีแล้ว" : "Prices include VAT"}
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="emailOnOrder" value="true" defaultChecked={values.emailOnOrder} className="accent-[#81917B]" />
            {locale === "th" ? "ส่งอีเมลเมื่อมีคำสั่งซื้อ" : "Email on new order"}
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="lineOnOrder" value="true" defaultChecked={values.lineOnOrder} className="accent-[#81917B]" />
            {locale === "th" ? "ส่งแจ้งเตือน LINE เมื่อมีคำสั่งซื้อ" : "LINE notify on new order"}
          </label>
        </Section>
      </div>

      <div className={tab === "delivery" ? "space-y-4" : "hidden"}>
        <Section title={locale === "th" ? "การจัดส่ง" : "Delivery"}>
          <div>
            <label className="label" htmlFor="shippingFee">Delivery fee (satang)</label>
            <input id="shippingFee" name="shippingFee" type="number" min={0} defaultValue={values.shippingFee} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="freeThreshold">Free delivery over (satang)</label>
            <input id="freeThreshold" name="freeThreshold" type="number" min={0} defaultValue={values.freeThreshold} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="cutoffHour">Same-day cut-off hour</label>
            <input id="cutoffHour" name="cutoffHour" type="number" min={0} max={23} defaultValue={values.cutoffHour} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="leadDays">Advance days</label>
            <input id="leadDays" name="leadDays" type="number" min={0} max={30} defaultValue={values.leadDays} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="maxDaysAhead">Booking window (days)</label>
            <input id="maxDaysAhead" name="maxDaysAhead" type="number" min={1} max={90} defaultValue={values.maxDaysAhead} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="defaultCapacity">Slot capacity</label>
            <input id="defaultCapacity" name="defaultCapacity" type="number" min={1} max={500} defaultValue={values.defaultCapacity} className="input h-9 text-xs" />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="sameDayEnabled" value="true" defaultChecked={values.sameDayEnabled} className="accent-[#81917B]" />
            {locale === "th" ? "เปิดรับส่งวันเดียวกัน" : "Enable same-day delivery"}
          </label>
          <div className="sm:col-span-2">
            <p className="label">{locale === "th" ? "วันหยุดประจำสัปดาห์" : "Closed weekdays"}</p>
            <div className="flex flex-wrap gap-3 text-xs">
              {[
                { value: 0, label: locale === "th" ? "อา." : "Sun" },
                { value: 1, label: locale === "th" ? "จ." : "Mon" },
                { value: 2, label: locale === "th" ? "อ." : "Tue" },
                { value: 3, label: locale === "th" ? "พ." : "Wed" },
                { value: 4, label: locale === "th" ? "พฤ." : "Thu" },
                { value: 5, label: locale === "th" ? "ศ." : "Fri" },
                { value: 6, label: locale === "th" ? "ส." : "Sat" },
              ].map((day) => (
                <label key={day.value} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    name="closedWeekdays"
                    value={day.value}
                    defaultChecked={values.closedWeekdays.includes(day.value)}
                    className="accent-[#81917B]"
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </div>
        </Section>
      </div>

      <div className={tab === "payment" ? "space-y-4" : "hidden"}>
        <Section title={locale === "th" ? "การชำระเงิน" : "Payment"}>
          <div className="sm:col-span-2">
            <p className="label">{locale === "th" ? "ช่องทางที่เปิดใช้" : "Enabled methods"}</p>
            <div className="flex flex-wrap gap-4 text-xs">
              {[
                { value: "promptpay", label: "PromptPay" },
                { value: "card", label: "Card" },
                { value: "bank_transfer", label: "Bank transfer" },
                { value: "cod", label: "Cash on delivery" },
              ].map((method) => (
                <label key={method.value} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    name="paymentMethods"
                    value={method.value}
                    defaultChecked={values.paymentMethods.includes(method.value)}
                    className="accent-[#81917B]"
                  />
                  {method.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="promptpayExpiryMinutes">Payment window (minutes)</label>
            <input id="promptpayExpiryMinutes" name="promptpayExpiryMinutes" type="number" min={5} max={180} defaultValue={values.promptpayExpiryMinutes} className="input h-9 text-xs" />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="codEnabled" value="true" defaultChecked={values.codEnabled} className="accent-[#81917B]" />
            {locale === "th" ? "เปิดใช้เก็บเงินปลายทาง" : "Enable cash on delivery"}
          </label>
        </Section>
      </div>

      <div className={tab === "seo" ? "space-y-4" : "hidden"}>
        <Section title="SEO">
          <div>
            <label className="label" htmlFor="seoTitleTh">Title (TH)</label>
            <input id="seoTitleTh" name="seoTitleTh" defaultValue={values.seoTitleTh} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="seoTitleEn">Title (EN)</label>
            <input id="seoTitleEn" name="seoTitleEn" defaultValue={values.seoTitleEn} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="seoDescriptionTh">Description (TH)</label>
            <textarea id="seoDescriptionTh" name="seoDescriptionTh" defaultValue={values.seoDescriptionTh} rows={3} className="textarea text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="seoDescriptionEn">Description (EN)</label>
            <textarea id="seoDescriptionEn" name="seoDescriptionEn" defaultValue={values.seoDescriptionEn} rows={3} className="textarea text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="seoKeywords">Keywords</label>
            <input id="seoKeywords" name="seoKeywords" defaultValue={values.seoKeywords} className="input h-9 text-xs" />
          </div>
          <div>
            <label className="label" htmlFor="ogImage">OG image URL</label>
            <input id="ogImage" name="ogImage" defaultValue={values.ogImage} className="input h-9 text-xs" />
          </div>
        </Section>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </form>
  );
}

export function SlotTemplatesForm({
  locale,
  templates,
}: {
  locale: string;
  templates: Array<{ start: string; end: string; capacity: number }>;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveSlotTemplatesAction, initial);
  const [rows, setRows] = useState(templates.length ? templates : [{ start: "09:00", end: "12:00", capacity: 10 }]);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <input name="slotStart" type="time" defaultValue={row.start} className="input h-9 w-auto text-xs" />
          <span className="text-muted">–</span>
          <input name="slotEnd" type="time" defaultValue={row.end} className="input h-9 w-auto text-xs" />
          <input name="slotCapacity" type="number" min={1} defaultValue={row.capacity} className="input h-9 w-20 text-xs" />
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, i) => i !== index))}
            className="text-danger"
            aria-label="Remove"
          >
            <IconTrash size={14} />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRows([...rows, { start: "18:00", end: "21:00", capacity: 8 }])}
          className="btn btn-ghost btn-sm"
        >
          <IconPlus size={14} />
          {t("admin.addSlot")}
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </button>
      </div>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-xs text-success">{state.message}</p> : null}
    </form>
  );
}
