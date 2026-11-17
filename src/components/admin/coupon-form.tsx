"use client";

import { useActionState } from "react";
import { saveCouponAction } from "@/app/actions/admin-marketing";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "../i18n-provider";

const initial: FormState = { ok: false };

export type CouponValues = {
  id?: string;
  code: string;
  descriptionTh: string;
  descriptionEn: string;
  type: string;
  value: number;
  minSpend: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  perCustomerLimit: number;
  startsAt: string;
  endsAt: string;
  status: string;
  appliesTo: string;
  productIds: string;
  categoryIds: string;
};

export function CouponForm({ locale, coupon }: { locale: string; coupon?: CouponValues }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveCouponAction, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      {coupon?.id ? <input type="hidden" name="id" value={coupon.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="coupon-code">Code *</label>
          <input id="coupon-code" name="code" defaultValue={coupon?.code} required className="input h-9 text-xs font-mono uppercase" />
          {state.fieldErrors?.code ? <p className="field-error">{state.fieldErrors.code}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="coupon-type">Type</label>
          <select id="coupon-type" name="type" defaultValue={coupon?.type ?? "percent"} className="input h-9 text-xs">
            <option value="percent">percent (basis points)</option>
            <option value="fixed">fixed (satang)</option>
            <option value="free_shipping">free shipping</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="coupon-value">Value</label>
          <input id="coupon-value" name="value" type="number" min={0} defaultValue={coupon?.value ?? 1000} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="coupon-min">Min spend (satang)</label>
          <input id="coupon-min" name="minSpend" type="number" min={0} defaultValue={coupon?.minSpend ?? 0} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="coupon-max">Max discount (satang)</label>
          <input id="coupon-max" name="maxDiscount" type="number" min={0} defaultValue={coupon?.maxDiscount ?? ""} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="coupon-limit">Usage limit</label>
          <input id="coupon-limit" name="usageLimit" type="number" min={1} defaultValue={coupon?.usageLimit ?? ""} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="coupon-per">Per customer</label>
          <input id="coupon-per" name="perCustomerLimit" type="number" min={1} defaultValue={coupon?.perCustomerLimit ?? 1} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="coupon-status">Status</label>
          <select id="coupon-status" name="status" defaultValue={coupon?.status ?? "active"} className="input h-9 text-xs">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="coupon-start">Starts</label>
          <input id="coupon-start" name="startsAt" type="date" required defaultValue={coupon?.startsAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="coupon-end">Ends</label>
          <input id="coupon-end" name="endsAt" type="date" defaultValue={coupon?.endsAt?.slice(0, 10) ?? ""} className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="coupon-applies">Applies to</label>
          <select id="coupon-applies" name="appliesTo" defaultValue={coupon?.appliesTo ?? "all"} className="input h-9 text-xs">
            <option value="all">all products</option>
            <option value="products">specific products</option>
            <option value="categories">specific categories</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="coupon-products">Product IDs (comma separated)</label>
          <input id="coupon-products" name="productIds" defaultValue={coupon?.productIds} className="input h-9 text-xs font-mono" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="coupon-descTh">Description (TH)</label>
          <input id="coupon-descTh" name="descriptionTh" defaultValue={coupon?.descriptionTh} className="input h-9 text-xs" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="coupon-descEn">Description (EN)</label>
          <input id="coupon-descEn" name="descriptionEn" defaultValue={coupon?.descriptionEn} className="input h-9 text-xs" />
        </div>
      </div>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-xs text-success">{state.message}</p> : null}
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}
