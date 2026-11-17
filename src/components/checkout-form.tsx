"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { placeOrderAction } from "@/app/actions/checkout";
import type { FormState } from "@/lib/schemas";
import type { DeliveryDay } from "@/lib/delivery";
import { formatMoney } from "@/lib/money";
import { formatDateOnly } from "@/lib/time";
import { useI18n } from "./i18n-provider";
import { IconArrowLeft, IconArrowRight, IconBank, IconCard, IconCheck, IconLock, IconQR, IconTruck } from "./icons";

type Field =
  | "contactName"
  | "email"
  | "phone"
  | "recipientName"
  | "recipientPhone"
  | "addressLine"
  | "subdistrict"
  | "district"
  | "province"
  | "postalCode"
  | "deliveryNotes"
  | "giftMessage"
  | "senderName"
  | "customerNote";

const initial: FormState = { ok: false };

const PAYMENT_ICONS: Record<string, typeof IconQR> = {
  promptpay: IconQR,
  card: IconCard,
  bank_transfer: IconBank,
  cod: IconTruck,
};

export function CheckoutForm({
  locale,
  days,
  methods,
  bank,
  savedAddresses,
  defaults,
  summary,
}: {
  locale: "th" | "en";
  days: DeliveryDay[];
  methods: Array<{ id: string; labelKey: string; available: boolean }>;
  bank: { name: string; accountNumber: string; accountName: string };
  savedAddresses: Array<{
    id: string;
    label: string;
    recipientName: string;
    phone: string;
    addressLine: string;
    subdistrict: string;
    district: string;
    province: string;
    postalCode: string;
  }>;
  defaults: { name: string; email: string; phone: string };
  summary: {
    items: Array<{ name: string; variantName: string | null; quantity: number; lineTotal: number; addons: string[] }>;
    subtotal: number;
    addonsTotal: number;
    discountTotal: number;
    shippingTotal: number;
    grandTotal: number;
    couponCode: string | null;
  };
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(placeOrderAction, initial);
  const [step, setStep] = useState(1);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const [values, setValues] = useState({
    contactName: defaults.name,
    email: defaults.email,
    phone: defaults.phone,
    recipientName: "",
    recipientPhone: "",
    addressLine: "",
    subdistrict: "",
    district: "",
    province: "",
    postalCode: "",
    deliveryNotes: "",
    deliveryDate: "",
    slotStart: "",
    slotEnd: "",
    giftMessage: "",
    senderName: defaults.name,
    anonymous: false,
    cardDesign: "classic",
    customerNote: "",
    paymentMethod: methods.find((m) => m.available)?.id ?? "",
    acceptTerms: false,
  });

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setLocalErrors((current) => {
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  };

  const openDays = useMemo(
    () => days.filter((day) => !day.closed && day.slots.some((slot) => !slot.closed && slot.remaining > 0)),
    [days],
  );

  const activeDay = openDays.find((day) => day.date === values.deliveryDate) ?? null;

  const errors = { ...state.fieldErrors, ...localErrors };
  const err = (key: string) => errors[key];

  const validateStep = (target: number): boolean => {
    const next: Record<string, string> = {};
    if (target >= 1 || step === 1) {
      if (values.contactName.trim().length < 2) next.contactName = t("validation.required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = t("validation.email");
      if (!/^(?:\+66|0)\d{8,9}$/.test(values.phone.replace(/[\s-]/g, ""))) next.phone = t("validation.phone");
      if (values.recipientName.trim().length < 2) next.recipientName = t("validation.required");
      if (!/^(?:\+66|0)\d{8,9}$/.test(values.recipientPhone.replace(/[\s-]/g, ""))) {
        next.recipientPhone = t("validation.phone");
      }
      if (values.addressLine.trim().length < 5) next.addressLine = t("validation.required");
      if (!values.subdistrict.trim()) next.subdistrict = t("validation.required");
      if (!values.district.trim()) next.district = t("validation.required");
      if (!values.province.trim()) next.province = t("validation.required");
      if (!/^\d{5}$/.test(values.postalCode)) next.postalCode = t("validation.postal");
    }
    if (target >= 2) {
      if (!values.deliveryDate) next.deliveryDate = t("validation.required");
      if (!values.slotStart) next.slotStart = t("validation.required");
    }
    if (target >= 4) {
      if (!values.paymentMethod) next.paymentMethod = t("validation.required");
      if (!values.acceptTerms) next.acceptTerms = t("validation.consent");
    }
    setLocalErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(4, current + 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setStep((current) => Math.max(1, current - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const steps = [
    { id: 1, label: t("checkout.step.contact") },
    { id: 2, label: t("checkout.step.schedule") },
    { id: 3, label: t("checkout.step.gift") },
    { id: 4, label: t("checkout.step.payment") },
  ];

  const inputProps = (key: Field) => ({
    name: key,
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      set(key, event.target.value),
    "aria-invalid": err(key) ? true : undefined,
    "aria-describedby": err(key) ? `${key}-error` : undefined,
  });

  const renderError = (key: string) => {
    const message = err(key);
    if (!message) return null;
    return (
      <p id={`${key}-error`} className="field-error" role="alert">
        {message}
      </p>
    );
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
      <form action={formAction} className="min-w-0" noValidate>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <input type="hidden" name="deliveryDate" value={values.deliveryDate} />
        <input type="hidden" name="slotStart" value={values.slotStart} />
        <input type="hidden" name="slotEnd" value={values.slotEnd} />
        <input type="hidden" name="paymentMethod" value={values.paymentMethod} />
        <input type="hidden" name="acceptTerms" value={values.acceptTerms ? "true" : "false"} />
        <input type="hidden" name="anonymous" value={values.anonymous ? "1" : "0"} />

        <ol className="mb-8 flex items-center gap-2 overflow-x-auto text-[11px] uppercase tracking-[0.1em] scrollbar-none">
          {steps.map((item) => (
            <li key={item.id} className="flex shrink-0 items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${
                  step > item.id ? "border-primary bg-primary text-white" : step === item.id ? "border-charcoal text-charcoal" : "border-line text-muted"
                }`}
              >
                {step > item.id ? <IconCheck size={12} /> : item.id}
              </span>
              <span className={step === item.id ? "text-charcoal" : "text-muted"}>{item.label}</span>
              {item.id < 4 ? <span className="mx-1 h-px w-6 bg-line" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>

        {/* Step 1 — contact + delivery address */}
        <section className={step === 1 ? "space-y-6" : "hidden"}>
          <div className="border border-line bg-white p-6">
            <h2 className="text-xl">{t("checkout.step.contact")}</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="contactName">{t("checkout.contactName")} *</label>
                <input id="contactName" className="input" required autoComplete="name" {...inputProps("contactName")} />
                {renderError("contactName")}
              </div>
              <div>
                <label className="label" htmlFor="email">{t("checkout.email")} *</label>
                <input id="email" type="email" className="input" required autoComplete="email" {...inputProps("email")} />
                {renderError("email")}
              </div>
              <div>
                <label className="label" htmlFor="phone">{t("checkout.phone")} *</label>
                <input id="phone" className="input" required inputMode="tel" autoComplete="tel" {...inputProps("phone")} />
                {renderError("phone")}
              </div>
            </div>
          </div>

          <div className="border border-line bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl">{t("checkout.step.delivery")}</h2>
              {savedAddresses.length > 0 ? (
                <select
                  className="input h-10 w-auto text-xs"
                  defaultValue=""
                  onChange={(event) => {
                    const address = savedAddresses.find((item) => item.id === event.target.value);
                    if (!address) return;
                    setValues((current) => ({
                      ...current,
                      recipientName: address.recipientName,
                      recipientPhone: address.phone,
                      addressLine: address.addressLine,
                      subdistrict: address.subdistrict,
                      district: address.district,
                      province: address.province,
                      postalCode: address.postalCode,
                    }));
                  }}
                  aria-label={t("account.addresses")}
                >
                  <option value="">{t("account.addresses")}</option>
                  {savedAddresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label} — {address.recipientName}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="recipientName">{t("checkout.recipientName")} *</label>
                <input id="recipientName" className="input" required {...inputProps("recipientName")} />
                {renderError("recipientName")}
              </div>
              <div>
                <label className="label" htmlFor="recipientPhone">{t("checkout.recipientPhone")} *</label>
                <input id="recipientPhone" className="input" required inputMode="tel" {...inputProps("recipientPhone")} />
                {renderError("recipientPhone")}
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="addressLine">{t("checkout.address")} *</label>
                <input id="addressLine" className="input" required autoComplete="street-address" {...inputProps("addressLine")} />
                {renderError("addressLine")}
              </div>
              <div>
                <label className="label" htmlFor="subdistrict">{t("checkout.subdistrict")} *</label>
                <input id="subdistrict" className="input" required {...inputProps("subdistrict")} />
                {renderError("subdistrict")}
              </div>
              <div>
                <label className="label" htmlFor="district">{t("checkout.district")} *</label>
                <input id="district" className="input" required {...inputProps("district")} />
                {renderError("district")}
              </div>
              <div>
                <label className="label" htmlFor="province">{t("checkout.province")} *</label>
                <input id="province" className="input" required {...inputProps("province")} />
                {renderError("province")}
              </div>
              <div>
                <label className="label" htmlFor="postalCode">{t("checkout.postalCode")} *</label>
                <input id="postalCode" className="input" required inputMode="numeric" maxLength={5} {...inputProps("postalCode")} />
                {renderError("postalCode")}
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="deliveryNotes">
                  {t("checkout.deliveryNotes")} <span className="normal-case tracking-normal">({t("common.optional")})</span>
                </label>
                <input id="deliveryNotes" className="input" maxLength={500} {...inputProps("deliveryNotes")} />
              </div>
            </div>
          </div>
        </section>

        {/* Step 2 — schedule */}
        <section className={step === 2 ? "space-y-6" : "hidden"}>
          <div className="border border-line bg-white p-6">
            <h2 className="text-xl">{t("checkout.step.schedule")}</h2>
            <p className="mt-1 text-xs text-muted">
              {locale === "th" ? "เลือกวันที่และช่วงเวลาที่ต้องการให้จัดส่ง" : "Choose a delivery date and window."}
            </p>
            {openDays.length === 0 ? (
              <p className="mt-4 text-sm text-danger">{t("checkout.noSlots")}</p>
            ) : (
              <>
                <div className="mt-5 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {openDays.slice(0, 21).map((day) => (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => {
                        set("deliveryDate", day.date);
                        set("slotStart", "");
                        set("slotEnd", "");
                      }}
                      className={`min-w-[92px] border px-3 py-2.5 text-center text-xs ${
                        values.deliveryDate === day.date
                          ? "border-primary bg-primary-soft text-primary-dark"
                          : "border-line bg-white hover:border-primary/60"
                      }`}
                    >
                      <span className="block font-medium">
                        {formatDateOnly(day.date, locale)}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted">
                        {day.slots.filter((slot) => !slot.closed && slot.remaining > 0).length}{" "}
                        {locale === "th" ? "ช่วงเวลา" : "windows"}
                      </span>
                    </button>
                  ))}
                </div>
                {renderError("deliveryDate")}

                {activeDay ? (
                  <div className="mt-5">
                    <p className="label">{t("checkout.deliverySlot")} *</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activeDay.slots.map((slot) => {
                        const full = slot.closed || slot.remaining <= 0;
                        return (
                          <button
                            key={slot.start}
                            type="button"
                            disabled={full}
                            onClick={() => {
                              set("slotStart", slot.start);
                              set("slotEnd", slot.end);
                            }}
                            className={`flex items-center justify-between border px-4 py-3 text-sm ${
                              values.slotStart === slot.start
                                ? "border-primary bg-primary-soft"
                                : "border-line bg-white hover:border-primary/60"
                            } ${full ? "cursor-not-allowed opacity-40" : ""}`}
                          >
                            <span>{slot.label}</span>
                            <span className="text-[11px] text-muted">
                              {full ? t("checkout.slotFull") : `${slot.remaining} ${locale === "th" ? "ที่ว่าง" : "left"}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {renderError("slotStart")}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        {/* Step 3 — gift */}
        <section className={step === 3 ? "space-y-6" : "hidden"}>
          <div className="border border-line bg-white p-6">
            <h2 className="text-xl">{t("checkout.step.gift")}</h2>
            <div className="mt-5 space-y-5">
              <div>
                <label className="label" htmlFor="giftMessage">
                  {t("checkout.giftMessage")} <span className="normal-case tracking-normal">({t("common.optional")})</span>
                </label>
                <textarea
                  id="giftMessage"
                  className="textarea"
                  maxLength={300}
                  placeholder={t("checkout.titlePlaceholder")}
                  {...inputProps("giftMessage")}
                />
                <p className="mt-1 text-right text-[11px] text-muted">{values.giftMessage.length}/300</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="senderName">{t("checkout.senderName")}</label>
                  <input
                    id="senderName"
                    className="input"
                    disabled={values.anonymous}
                    {...inputProps("senderName")}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="cardDesign">{t("checkout.cardDesign")}</label>
                  <select
                    id="cardDesign"
                    className="select"
                    value={values.cardDesign}
                    onChange={(event) => set("cardDesign", event.target.value)}
                    name="cardDesign"
                  >
                    <option value="classic">{locale === "th" ? "คลาสสิกงาช้าง" : "Ivory classic"}</option>
                    <option value="botanical">{locale === "th" ? "พฤกษศาสตร์" : "Botanical"}</option>
                    <option value="minimal">{locale === "th" ? "มินิมอล" : "Minimal"}</option>
                    <option value="none">{locale === "th" ? "ไม่ต้องใช้การ์ด" : "No card"}</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.anonymous}
                  onChange={(event) => {
                    set("anonymous", event.target.checked);
                    if (event.target.checked) set("senderName", "");
                  }}
                  className="accent-[#81917B]"
                />
                {t("checkout.anonymous")}
              </label>
              <div>
                <label className="label" htmlFor="customerNote">{t("checkout.customerNote")}</label>
                <textarea id="customerNote" className="textarea" maxLength={500} {...inputProps("customerNote")} />
              </div>
            </div>
          </div>
        </section>

        {/* Step 4 — payment + review */}
        <section className={step === 4 ? "space-y-6" : "hidden"}>
          <div className="border border-line bg-white p-6">
            <h2 className="text-xl">{t("checkout.step.payment")}</h2>
            <div className="mt-5 space-y-2">
              {methods.map((method) => {
                const Icon = PAYMENT_ICONS[method.id] ?? IconBank;
                return (
                  <label
                    key={method.id}
                    className={`flex cursor-pointer items-center gap-3 border px-4 py-3.5 text-sm ${
                      values.paymentMethod === method.id
                        ? "border-primary bg-primary-soft"
                        : "border-line bg-white hover:border-primary/60"
                    } ${method.available ? "" : "cursor-not-allowed opacity-50"}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethodChoice"
                      checked={values.paymentMethod === method.id}
                      disabled={!method.available}
                      onChange={() => set("paymentMethod", method.id)}
                      className="accent-[#81917B]"
                    />
                    <Icon size={18} className="text-primary" />
                    <span className="flex-1">{t(method.labelKey as never)}</span>
                  </label>
                );
              })}
              {renderError("paymentMethod")}
            </div>

            {values.paymentMethod === "bank_transfer" ? (
              <div className="mt-4 border border-line bg-cream p-4 text-xs leading-relaxed text-muted">
                <p className="font-medium text-charcoal">{t("payment.bankDetails")}</p>
                <p className="mt-2">{bank.name}</p>
                <p>{bank.accountName}</p>
                <p className="font-mono text-sm tracking-wide text-charcoal">{bank.accountNumber}</p>
                <p className="mt-2">{t("checkout.payment.bankNote")}</p>
              </div>
            ) : null}

            {values.paymentMethod === "promptpay" ? (
              <p className="mt-4 text-xs leading-relaxed text-muted">
                {locale === "th"
                  ? "หลังยืนยันคำสั่งซื้อ ระบบจะแสดง QR PromptPay พร้อมเวลาหมดอายุ"
                  : "After confirming, a PromptPay QR with an expiry timer will be shown."}
              </p>
            ) : null}
          </div>

          <div className="border border-line bg-white p-6">
            <h2 className="text-xl">{t("checkout.reviewTitle")}</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t("checkout.recipientName")}</dt>
                <dd className="text-right">
                  {values.recipientName} · {values.recipientPhone}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t("checkout.address")}</dt>
                <dd className="text-right">
                  {values.addressLine} {values.subdistrict} {values.district} {values.province} {values.postalCode}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">{t("checkout.deliveryDate")}</dt>
                <dd className="text-right">
                  {values.deliveryDate ? formatDateOnly(values.deliveryDate, locale) : "—"}
                  {values.slotStart ? ` · ${values.slotStart} – ${values.slotEnd}` : ""}
                </dd>
              </div>
              {values.giftMessage ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t("checkout.giftMessage")}</dt>
                  <dd className="max-w-[60%] text-right">“{values.giftMessage}”</dd>
                </div>
              ) : null}
            </dl>
            <label className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted">
              <input
                type="checkbox"
                checked={values.acceptTerms}
                onChange={(event) => set("acceptTerms", event.target.checked)}
                className="mt-0.5 accent-[#81917B]"
              />
              <span>
                {t("checkout.terms")}{" "}
                <Link href={`/${locale}/policies/terms`} target="_blank" className="text-primary-dark underline underline-offset-2">
                  {t("footer.terms")}
                </Link>
              </span>
            </label>
            {renderError("acceptTerms")}
          </div>

          {state.error ? (
            <div role="alert" className="border border-[#f0d6d0] bg-[#fdf0ed] px-4 py-3 text-sm text-danger">
              {state.error}
            </div>
          ) : null}
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={goBack} className={`btn btn-ghost ${step === 1 ? "invisible" : ""}`}>
            <IconArrowLeft size={16} />
            {t("common.back")}
          </button>
          {step < 4 ? (
            <button type="button" onClick={goNext} className="btn btn-primary">
              {t("common.continue")}
              <IconArrowRight size={16} />
            </button>
          ) : (
            <button type="submit" className="btn btn-primary min-w-[220px]" disabled={pending}>
              {pending ? t("checkout.processing") : t("checkout.placeOrder")}
            </button>
          )}
        </div>
      </form>

      {/* Summary */}
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="border border-line bg-white p-6">
          <h2 className="text-xl">{t("checkout.orderSummary")}</h2>
          <ul className="mt-5 space-y-4 border-b border-line pb-5">
            {summary.items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex justify-between gap-4 text-sm">
                <span>
                  {item.name}
                  {item.variantName ? <span className="block text-[11px] text-muted">{item.variantName}</span> : null}
                  {item.addons.length > 0 ? <span className="block text-[11px] text-muted">+ {item.addons.join(", ")}</span> : null}
                  <span className="block text-[11px] text-muted">× {item.quantity}</span>
                </span>
                <span>{formatMoney(item.lineTotal, { locale })}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">{t("common.subtotal")}</dt>
              <dd>{formatMoney(summary.subtotal + summary.addonsTotal, { locale })}</dd>
            </div>
            {summary.discountTotal > 0 ? (
              <div className="flex justify-between text-primary-dark">
                <dt>{t("common.discount")}{summary.couponCode ? ` (${summary.couponCode})` : ""}</dt>
                <dd>−{formatMoney(summary.discountTotal, { locale })}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted">{t("common.shipping")}</dt>
              <dd>{summary.shippingTotal === 0 ? t("common.free") : formatMoney(summary.shippingTotal, { locale })}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-medium">
              <dt>{t("common.total")}</dt>
              <dd>{formatMoney(summary.grandTotal, { locale })}</dd>
            </div>
          </dl>
          <p className="mt-4 flex items-center gap-2 text-[11px] text-muted">
            <IconLock size={13} />
            {t("checkout.payment.secureNote")}
          </p>
        </div>
      </aside>
    </div>
  );
}
