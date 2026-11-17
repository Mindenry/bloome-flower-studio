"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  saveAddressAction,
  saveRecipientAction,
  saveReminderAction,
  updateProfileAction,
} from "@/app/actions/account";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "./i18n-provider";

const initial: FormState = { ok: false };

function Feedback({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="border border-[#f0d6d0] bg-[#fdf0ed] px-4 py-2.5 text-xs text-danger">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="border border-[#d7e6da] bg-[#eef5f0] px-4 py-2.5 text-xs text-success">
        {state.message}
      </p>
    );
  }
  return null;
}

function Err({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

export function ProfileForm({
  locale,
  user,
}: {
  locale: string;
  user: { name: string; phone: string | null; locale: string; marketingConsent: boolean; email: string | null };
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(updateProfileAction, initial);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="profile-name">{t("auth.name")}</label>
          <input id="profile-name" name="name" defaultValue={user.name} required className="input" />
          <Err message={state.fieldErrors?.name} />
        </div>
        <div>
          <label className="label" htmlFor="profile-phone">{t("auth.phone")}</label>
          <input id="profile-phone" name="phone" defaultValue={user.phone ?? ""} inputMode="tel" className="input" />
          <Err message={state.fieldErrors?.phone} />
        </div>
        <div>
          <label className="label" htmlFor="profile-email">{t("auth.email")}</label>
          <input id="profile-email" value={user.email ?? ""} readOnly disabled className="input bg-cream text-muted" />
        </div>
        <div>
          <label className="label" htmlFor="profile-locale">{t("common.language")}</label>
          <select id="profile-locale" name="locale" defaultValue={user.locale} className="select">
            <option value="th">ไทย</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <label className="flex items-start gap-2 text-xs text-muted">
        <input type="checkbox" name="marketingConsent" value="true" defaultChecked={user.marketingConsent} className="mt-0.5 accent-[#81917B]" />
        {t("auth.marketing")}
      </label>
      <Feedback state={state} />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}

export function AddressForm({
  locale,
  address,
}: {
  locale: string;
  address?: {
    id: string;
    label: string;
    recipientName: string;
    phone: string;
    addressLine: string;
    subdistrict: string;
    district: string;
    province: string;
    postalCode: string;
  } | null;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveAddressAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="addr-label">{t("account.addresses")}</label>
          <input id="addr-label" name="label" defaultValue={address?.label ?? "home"} className="input" maxLength={40} />
        </div>
        <div>
          <label className="label" htmlFor="addr-name">{t("checkout.recipientName")}</label>
          <input id="addr-name" name="recipientName" defaultValue={address?.recipientName} required className="input" />
          <Err message={state.fieldErrors?.recipientName} />
        </div>
        <div>
          <label className="label" htmlFor="addr-phone">{t("checkout.recipientPhone")}</label>
          <input id="addr-phone" name="phone" defaultValue={address?.phone} required inputMode="tel" className="input" />
          <Err message={state.fieldErrors?.phone} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="addr-line">{t("checkout.address")}</label>
          <input id="addr-line" name="addressLine" defaultValue={address?.addressLine} required className="input" />
          <Err message={state.fieldErrors?.addressLine} />
        </div>
        <div>
          <label className="label" htmlFor="addr-sub">{t("checkout.subdistrict")}</label>
          <input id="addr-sub" name="subdistrict" defaultValue={address?.subdistrict} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="addr-district">{t("checkout.district")}</label>
          <input id="addr-district" name="district" defaultValue={address?.district} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="addr-province">{t("checkout.province")}</label>
          <input id="addr-province" name="province" defaultValue={address?.province} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="addr-postal">{t("checkout.postalCode")}</label>
          <input id="addr-postal" name="postalCode" defaultValue={address?.postalCode} required inputMode="numeric" maxLength={5} className="input" />
          <Err message={state.fieldErrors?.postalCode} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" name="isDefault" value="true" className="accent-[#81917B]" />
        {t("account.defaultAddress")}
      </label>
      <Feedback state={state} />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}

export function RecipientForm({
  locale,
  recipient,
}: {
  locale: string;
  recipient?: {
    id: string;
    name: string;
    phone: string;
    addressLine: string;
    subdistrict: string;
    district: string;
    province: string;
    postalCode: string;
    note: string | null;
    birthday: string | null;
  } | null;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveRecipientAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {recipient ? <input type="hidden" name="id" value={recipient.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rcp-name">{t("checkout.recipientName")}</label>
          <input id="rcp-name" name="name" defaultValue={recipient?.name} required className="input" />
          <Err message={state.fieldErrors?.name} />
        </div>
        <div>
          <label className="label" htmlFor="rcp-phone">{t("checkout.recipientPhone")}</label>
          <input id="rcp-phone" name="phone" defaultValue={recipient?.phone} required inputMode="tel" className="input" />
          <Err message={state.fieldErrors?.phone} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="rcp-address">{t("checkout.address")}</label>
          <input id="rcp-address" name="addressLine" defaultValue={recipient?.addressLine} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="rcp-sub">{t("checkout.subdistrict")}</label>
          <input id="rcp-sub" name="subdistrict" defaultValue={recipient?.subdistrict} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="rcp-district">{t("checkout.district")}</label>
          <input id="rcp-district" name="district" defaultValue={recipient?.district} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="rcp-province">{t("checkout.province")}</label>
          <input id="rcp-province" name="province" defaultValue={recipient?.province} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor="rcp-postal">{t("checkout.postalCode")}</label>
          <input id="rcp-postal" name="postalCode" defaultValue={recipient?.postalCode} required inputMode="numeric" maxLength={5} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="rcp-birthday">{t("account.reminders")}</label>
          <input id="rcp-birthday" name="birthday" type="date" defaultValue={recipient?.birthday ?? ""} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="rcp-note">{t("common.optionalNote")}</label>
          <input id="rcp-note" name="note" defaultValue={recipient?.note ?? ""} maxLength={300} className="input" />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}

export function ReminderForm({
  locale,
  reminder,
}: {
  locale: string;
  reminder?: {
    id: string;
    recipientName: string;
    occasion: string;
    eventDate: string;
    remindDaysBefore: number;
    notifyEmail: boolean;
    notifyLine: boolean;
    note: string | null;
  } | null;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveReminderAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {reminder ? <input type="hidden" name="id" value={reminder.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="rmd-name">{t("checkout.recipientName")}</label>
          <input id="rmd-name" name="recipientName" defaultValue={reminder?.recipientName} required className="input" />
          <Err message={state.fieldErrors?.recipientName} />
        </div>
        <div>
          <label className="label" htmlFor="rmd-occasion">{t("finder.occasion")}</label>
          <select id="rmd-occasion" name="occasion" defaultValue={reminder?.occasion ?? "birthday"} className="select">
            <option value="birthday">{locale === "th" ? "วันเกิด" : "Birthday"}</option>
            <option value="anniversary">{locale === "th" ? "วันครบรอบ" : "Anniversary"}</option>
            <option value="wedding_anniversary">{locale === "th" ? "วันครบรอบแต่งงาน" : "Wedding anniversary"}</option>
            <option value="other">{locale === "th" ? "วันสำคัญอื่น ๆ" : "Other"}</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="rmd-date">{t("common.date")}</label>
          <input id="rmd-date" name="eventDate" type="date" defaultValue={reminder?.eventDate ?? ""} required className="input" />
          <Err message={state.fieldErrors?.eventDate} />
        </div>
        <div>
          <label className="label" htmlFor="rmd-days">{locale === "th" ? "แจ้งเตือนล่วงหน้า (วัน)" : "Remind before (days)"}</label>
          <input id="rmd-days" name="remindDaysBefore" type="number" min={1} max={60} defaultValue={reminder?.remindDaysBefore ?? 7} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="rmd-note">{t("common.optionalNote")}</label>
          <input id="rmd-note" name="note" defaultValue={reminder?.note ?? ""} maxLength={300} className="input" />
        </div>
        <div className="flex flex-col justify-end gap-2 text-xs text-muted">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="notifyEmail" value="true" defaultChecked={reminder?.notifyEmail ?? true} className="accent-[#81917B]" />
            {t("auth.email")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="notifyLine" value="true" defaultChecked={reminder?.notifyLine ?? false} className="accent-[#81917B]" />
            LINE
          </label>
        </div>
      </div>
      <p className="text-[11px] text-muted">{t("account.reminderHint")}</p>
      <Feedback state={state} />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}

export function ChangePasswordForm({ locale }: { locale: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label className="label" htmlFor="pw-current">{t("account.currentPassword")}</label>
        <input id="pw-current" name="currentPassword" type="password" required autoComplete="current-password" className="input" />
        <Err message={state.fieldErrors?.currentPassword} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pw-new">{t("account.newPassword")}</label>
          <input id="pw-new" name="newPassword" type="password" required minLength={8} autoComplete="new-password" className="input" />
          <Err message={state.fieldErrors?.newPassword} />
        </div>
        <div>
          <label className="label" htmlFor="pw-confirm">{t("auth.confirmPassword")}</label>
          <input id="pw-confirm" name="confirmPassword" type="password" required autoComplete="new-password" className="input" />
          <Err message={state.fieldErrors?.confirmPassword} />
        </div>
      </div>
      <Feedback state={state} />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? t("common.saving") : t("account.changePassword")}
      </button>
    </form>
  );
}
