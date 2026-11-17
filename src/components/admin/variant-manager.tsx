"use client";

import { useActionState } from "react";
import { deleteVariantAction, saveVariantAction, updateVariantAction } from "@/app/actions/admin-products";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "../i18n-provider";

const initial: FormState = { ok: false };

type Variant = {
  id: string;
  sku: string;
  nameTh: string;
  nameEn: string;
  priceDelta: number;
  stockQuantity: number;
  status: string;
};

export function VariantManager({ locale, productId, variants }: { locale: string; productId: string; variants: Variant[] }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveVariantAction, initial);

  return (
    <section className="border border-line bg-white p-5">
      <h2 className="text-sm font-medium">{t("admin.tabs.variants")}</h2>
      <p className="mt-1 text-[11px] text-muted">
        {locale === "th"
          ? "ตัวเลือกขนาด/รูปแบบ พร้อมราคาเพิ่มและสต็อกแยก"
          : "Size or style options with their own price delta and stock."}
      </p>

      {variants.length > 0 ? (
        <ul className="mt-4 divide-y divide-line">
          {variants.map((variant) => (
            <li key={variant.id} className="py-3">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span>
                    {locale === "th" ? variant.nameTh : variant.nameEn}
                    <span className="ml-2 font-mono text-[10px] text-muted">{variant.sku}</span>
                  </span>
                  <span className="text-[11px] text-muted">
                    {variant.priceDelta === 0 ? "±0" : `+${(variant.priceDelta / 100).toFixed(2)}`} · {variant.stockQuantity} ·{" "}
                    {variant.status === "active" ? t("status.active") : t("status.inactive")}
                  </span>
                </summary>
                <form action={updateVariantAction} className="mt-3 grid gap-2 sm:grid-cols-5">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="productId" value={productId} />
                  <input type="hidden" name="id" value={variant.id} />
                  <input name="sku" defaultValue={variant.sku} className="input h-9 text-xs" placeholder="SKU" />
                  <input name="nameTh" defaultValue={variant.nameTh} className="input h-9 text-xs" placeholder="ชื่อ (TH)" />
                  <input name="nameEn" defaultValue={variant.nameEn} className="input h-9 text-xs" placeholder="Name (EN)" />
                  <input name="priceDelta" type="number" defaultValue={variant.priceDelta / 100} className="input h-9 text-xs" placeholder="Δ satang" />
                  <div className="flex gap-2">
                    <input name="stockQuantity" type="number" defaultValue={variant.stockQuantity} className="input h-9 text-xs" placeholder="Stock" />
                    <button type="submit" className="btn btn-ghost btn-sm shrink-0">
                      {t("common.save")}
                    </button>
                  </div>
                </form>
                <form action={deleteVariantAction} className="mt-2">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="productId" value={productId} />
                  <input type="hidden" name="id" value={variant.id} />
                  <button type="submit" className="text-[11px] text-danger underline underline-offset-2">
                    {t("common.delete")}
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={action} className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-6">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="productId" value={productId} />
        <input name="sku" placeholder="SKU suffix" className="input h-9 text-xs" required />
        <input name="nameTh" placeholder="ชื่อ (TH)" className="input h-9 text-xs" required />
        <input name="nameEn" placeholder="Name (EN)" className="input h-9 text-xs" required />
        <input name="priceDelta" type="number" defaultValue={0} placeholder="Δ satang" className="input h-9 text-xs" />
        <input name="stockQuantity" type="number" defaultValue={0} placeholder="Stock" className="input h-9 text-xs" />
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? t("common.saving") : t("common.create")}
        </button>
        {state.error ? <p className="sm:col-span-6 text-xs text-danger">{state.error}</p> : null}
        {state.ok ? <p className="sm:col-span-6 text-xs text-success">{state.message}</p> : null}
      </form>
    </section>
  );
}
