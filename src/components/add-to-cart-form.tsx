"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { addToCartAction } from "@/app/actions/cart";
import type { FormState } from "@/lib/schemas";
import type { Addon, ProductVariant } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { useI18n } from "./i18n-provider";
import { IconMinus, IconPlus } from "./icons";

const initial: FormState = { ok: false };

export function AddToCartForm({
  productId,
  price,
  stock,
  variants,
  addons,
  hasVariants,
}: {
  productId: string;
  price: number;
  stock: number;
  variants: ProductVariant[];
  addons: Addon[];
  hasVariants: boolean;
}) {
  const { locale, t } = useI18n();
  const [state, action, pending] = useActionState(addToCartAction, initial);
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState<string>(hasVariants ? variants[0]?.id ?? "" : "");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const activeVariant = variants.find((variant) => variant.id === variantId);
  const maxStock = activeVariant ? activeVariant.stockQuantity : stock;
  const maxQuantity = Math.max(1, Math.min(20, maxStock));

  const unitPrice = useMemo(() => {
    const delta = activeVariant?.priceDelta ?? 0;
    return price + delta;
  }, [price, activeVariant]);

  const addonsTotal = useMemo(
    () =>
      selectedAddons.reduce((sum, id) => {
        const addon = addons.find((item) => item.id === id);
        return sum + (addon?.price ?? 0);
      }, 0),
    [selectedAddons, addons],
  );

  const total = (unitPrice + addonsTotal) * quantity;
  const disabled = maxStock <= 0 || pending;

  const toggleAddon = (id: string) => {
    setSelectedAddons((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="variantId" value={variantId || "none"} />
      {selectedAddons.map((id) => (
        <input key={id} type="hidden" name="addonIds" value={id} />
      ))}

      {hasVariants ? (
        <fieldset>
          <legend className="label mb-2">{t("product.selectVariant")}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const disabledVariant = variant.stockQuantity <= 0;
              return (
                <label
                  key={variant.id}
                  className={`min-w-[86px] cursor-pointer border px-4 py-2.5 text-center text-sm transition-colors ${
                    variantId === variant.id
                      ? "border-primary bg-primary-soft text-primary-dark"
                      : "border-line bg-white hover:border-primary/60"
                  } ${disabledVariant ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <input
                    type="radio"
                    name="variantChoice"
                    value={variant.id}
                    className="sr-only"
                    checked={variantId === variant.id}
                    disabled={disabledVariant}
                    onChange={() => {
                      setVariantId(variant.id);
                      setQuantity(1);
                    }}
                  />
                  <span className="block">{variant.name}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {variant.priceDelta === 0
                      ? formatMoney(price, { locale })
                      : `${variant.priceDelta > 0 ? "+" : "−"}${formatMoney(Math.abs(variant.priceDelta), { locale })}`}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {addons.length > 0 ? (
        <fieldset>
          <legend className="label mb-2">{t("product.addons")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {addons.map((addon) => (
              <label
                key={addon.id}
                className={`flex cursor-pointer items-center justify-between gap-3 border px-3 py-2.5 text-sm transition-colors ${
                  selectedAddons.includes(addon.id)
                    ? "border-primary bg-primary-soft"
                    : "border-line bg-white hover:border-primary/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedAddons.includes(addon.id)}
                    onChange={() => toggleAddon(addon.id)}
                    className="accent-[#81917B]"
                  />
                  <span>{addon.name}</span>
                </span>
                <span className="text-xs text-muted">
                  {addon.price === 0 ? t("common.free") : formatMoney(addon.price, { locale })}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center border border-line bg-white">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            className="flex h-11 w-11 items-center justify-center text-muted hover:text-charcoal disabled:opacity-40"
            disabled={quantity <= 1}
            aria-label={t("common.quantity")}
          >
            <IconMinus size={16} />
          </button>
          <span className="w-10 text-center text-sm" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
            className="flex h-11 w-11 items-center justify-center text-muted hover:text-charcoal disabled:opacity-40"
            disabled={quantity >= maxQuantity}
            aria-label={t("common.quantity")}
          >
            <IconPlus size={16} />
          </button>
        </div>
        <div className="text-sm">
          <span className="text-muted">{t("common.total")}: </span>
          <span className="font-medium">{formatMoney(total, { locale })}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" className="btn btn-primary flex-1" disabled={disabled}>
          {pending ? t("common.loading") : maxStock <= 0 ? t("product.outOfStock") : t("product.addToCart")}
        </button>
        <button
          type="submit"
          name="buyNow"
          value="1"
          className="btn btn-outline flex-1"
          disabled={disabled}
        >
          {t("product.buyNow")}
        </button>
      </div>

      {maxStock > 0 && maxStock <= 5 ? (
        <p className="text-xs text-warning">{t("product.lowStock", { count: maxStock })}</p>
      ) : null}

      {state.error ? (
        <p role="alert" className="border border-[#f0d6d0] bg-[#fdf0ed] px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <div role="status" className="flex items-center justify-between gap-3 border border-[#d7e6da] bg-[#eef5f0] px-4 py-3 text-sm text-success">
          <span>{state.message ?? t("product.added")}</span>
          <Link href={`/${locale}/cart`} className="underline underline-offset-4">
            {t("nav.cart")}
          </Link>
        </div>
      ) : null}
    </form>
  );
}
