"use client";

import { useActionState } from "react";
import { trackOrderAction } from "@/app/actions/order";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "./i18n-provider";

const initial: FormState = { ok: false };

export function TrackOrderForm({ defaultNumber = "" }: { defaultNumber?: string }) {
  const { locale, t } = useI18n();
  const [state, action, pending] = useActionState(trackOrderAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label className="label" htmlFor="track-number">
          {t("payment.orderNumber")}
        </label>
        <input
          id="track-number"
          name="orderNumber"
          defaultValue={defaultNumber}
          required
          className="input font-mono uppercase"
          placeholder="FLW-20260101-0001"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="label" htmlFor="track-email">
          {t("auth.email")}
        </label>
        <input id="track-email" name="email" type="email" required className="input" autoComplete="email" />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? t("common.loading") : t("order.track.cta")}
      </button>
    </form>
  );
}
