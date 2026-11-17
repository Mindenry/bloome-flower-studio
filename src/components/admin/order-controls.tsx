"use client";

import { useActionState } from "react";
import {
  addOrderNoteAction,
  addTrackingAction,
  refundOrderAction,
  updateOrderStatusAction,
} from "@/app/actions/admin-orders";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "../i18n-provider";

const initial: FormState = { ok: false };

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="mt-2 text-xs text-danger">{state.error}</p>;
  if (state.ok && state.message) return <p role="status" className="mt-2 text-xs text-success">{state.message}</p>;
  return null;
}

export function StatusUpdateForm({
  locale,
  orderId,
  options,
  label,
}: {
  locale: string;
  orderId: string;
  options: Array<{ value: string; label: string }>;
  label: string;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(updateOrderStatusAction, initial);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="orderId" value={orderId} />
      <label className="label" htmlFor="order-status">{label}</label>
      <select id="order-status" name="status" className="select h-9 text-xs">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input name="message" className="input h-9 text-xs" placeholder={t("admin.customerNote")} maxLength={400} />
      <button type="submit" className="btn btn-primary btn-sm w-full" disabled={pending}>
        {pending ? t("common.saving") : t("admin.updateStatus")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function NoteForm({ locale, orderId, internalNote }: { locale: string; orderId: string; internalNote: string | null }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(addOrderNoteAction, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="orderId" value={orderId} />
      <label className="label" htmlFor="internal-note">{t("admin.internalNote")}</label>
      <textarea id="internal-note" name="internalNote" defaultValue={internalNote ?? ""} rows={3} className="textarea text-xs" maxLength={2000} />
      <label className="label" htmlFor="customer-note">{t("admin.customerNote")}</label>
      <textarea id="customer-note" name="customerNote" rows={2} className="textarea text-xs" maxLength={2000} />
      <button type="submit" className="btn btn-ghost btn-sm w-full" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function TrackingForm({
  locale,
  orderId,
  carrier,
  trackingNumber,
  note,
}: {
  locale: string;
  orderId: string;
  carrier: string | null;
  trackingNumber: string | null;
  note: string | null;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(addTrackingAction, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="orderId" value={orderId} />
      <label className="label" htmlFor="carrier">{locale === "th" ? "ขนส่ง" : "Carrier"}</label>
      <input id="carrier" name="carrier" defaultValue={carrier ?? ""} className="input h-9 text-xs" />
      <label className="label" htmlFor="tracking">{t("admin.addTracking")}</label>
      <input id="tracking" name="trackingNumber" defaultValue={trackingNumber ?? ""} className="input h-9 text-xs font-mono" />
      <input name="note" defaultValue={note ?? ""} className="input h-9 text-xs" placeholder={t("common.optionalNote")} />
      <button type="submit" className="btn btn-ghost btn-sm w-full" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function RefundForm({ locale, orderId, maxAmount }: { locale: string; orderId: string; maxAmount: number }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(refundOrderAction, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="orderId" value={orderId} />
      <label className="label" htmlFor="refund-amount">{t("admin.refundAmount")} (THB)</label>
      <input
        id="refund-amount"
        name="amount"
        type="number"
        step="0.01"
        min={0}
        max={maxAmount / 100}
        defaultValue={(maxAmount / 100).toFixed(2)}
        className="input h-9 text-xs"
      />
      <input name="reason" className="input h-9 text-xs" placeholder={t("admin.refundReason")} maxLength={400} />
      <label className="flex items-center gap-2 text-[11px] text-muted">
        <input type="checkbox" name="manual" value="1" className="accent-[#81917B]" />
        {t("admin.manualRefund")}
      </label>
      <button type="submit" className="btn btn-sm w-full border-danger text-danger hover:bg-danger hover:text-white" disabled={pending}>
        {pending ? t("common.loading") : t("admin.processRefund")}
      </button>
      <Feedback state={state} />
    </form>
  );
}
