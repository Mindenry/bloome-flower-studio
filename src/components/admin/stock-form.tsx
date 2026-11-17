"use client";

import { useActionState, useState } from "react";
import { adjustStockAction } from "@/app/actions/admin-products";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "../i18n-provider";

const initial: FormState = { ok: false };

export function StockForm({
  locale,
  products,
}: {
  locale: string;
  products: Array<{ id: string; label: string; stock: number }>;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(adjustStockAction, initial);
  const [productId, setProductId] = useState(products[0]?.id ?? "");

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label className="label" htmlFor="stock-product">{t("admin.products")}</label>
        <select
          id="stock-product"
          name="productId"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          className="input h-9 text-xs"
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.label} ({product.stock})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="stock-type">{t("common.status")}</label>
          <select id="stock-type" name="type" className="input h-9 text-xs">
            <option value="in">{t("admin.stockIn")}</option>
            <option value="out">{t("admin.stockOut")}</option>
            <option value="adjust">{t("admin.adjustStock")}</option>
            <option value="waste">{t("admin.waste")}</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="stock-qty">{t("common.quantity")}</label>
          <input id="stock-qty" name="quantity" type="number" min={1} required className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="stock-batch">{t("admin.batches")}</label>
          <input id="stock-batch" name="batchCode" className="input h-9 text-xs" placeholder="BLM-2026-01" />
        </div>
        <div>
          <label className="label" htmlFor="stock-expiry">{t("admin.expiry")}</label>
          <input id="stock-expiry" name="expiryAt" type="date" className="input h-9 text-xs" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="stock-note">{t("common.optionalNote")}</label>
        <input id="stock-note" name="note" className="input h-9 text-xs" maxLength={300} />
      </div>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-xs text-success">{state.message}</p> : null}
      <button type="submit" className="btn btn-primary btn-sm w-full" disabled={pending || !productId}>
        {pending ? t("common.saving") : t("admin.adjustStock")}
      </button>
    </form>
  );
}
