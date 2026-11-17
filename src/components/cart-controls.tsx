"use client";

import { useActionState, useState } from "react";
import { applyCouponAction, removeCartItemAction, removeCouponAction, updateCartItemAction } from "@/app/actions/cart";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "./i18n-provider";
import { IconMinus, IconPlus, IconTrash } from "./icons";

const initial: FormState = { ok: false };

export function CouponForm({ currentCode, appliedLabel }: { currentCode?: string | null; appliedLabel: string }) {
  const { locale, t } = useI18n();
  const [state, action, pending] = useActionState(applyCouponAction, initial);

  if (currentCode) {
    return (
      <div className="border border-line bg-primary-soft px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">
            <span className="font-medium tracking-wide">{currentCode}</span>
            <span className="ml-2 text-xs text-muted">{appliedLabel}</span>
          </span>
          <form action={removeCouponAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="text-xs underline underline-offset-4 hover:text-danger">
              {t("common.delete")}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <div className="flex gap-2">
        <input
          name="code"
          placeholder={t("cart.couponPlaceholder")}
          className="input flex-1 uppercase"
          aria-label={t("cart.coupon")}
          autoComplete="off"
          maxLength={40}
        />
        <button type="submit" className="btn btn-ghost shrink-0" disabled={pending}>
          {pending ? t("common.loading") : t("cart.applyCoupon")}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-xs text-success">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function CartQuantity({ itemId, quantity, max }: { itemId: string; quantity: number; max: number }) {
  const { locale, t } = useI18n();
  const [value, setValue] = useState(quantity);
  const [pending, setPending] = useState(false);

  const submit = async (next: number) => {
    setValue(next);
    setPending(true);
    const formData = new FormData();
    formData.set("itemId", itemId);
    formData.set("quantity", String(next));
    formData.set("locale", locale);
    await updateCartItemAction(formData);
    setPending(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className={`flex items-center border border-line bg-white ${pending ? "opacity-60" : ""}`}>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center text-muted hover:text-charcoal disabled:opacity-40"
          onClick={() => submit(Math.max(1, value - 1))}
          disabled={value <= 1 || pending}
          aria-label={t("common.quantity")}
        >
          <IconMinus size={14} />
        </button>
        <span className="w-8 text-center text-sm" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center text-muted hover:text-charcoal disabled:opacity-40"
          onClick={() => submit(Math.min(max, value + 1))}
          disabled={value >= max || pending}
          aria-label={t("common.quantity")}
        >
          <IconPlus size={14} />
        </button>
      </div>
      <form action={removeCartItemAction}>
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="flex items-center gap-1.5 text-xs text-muted hover:text-danger"
          aria-label={t("cart.remove")}
        >
          <IconTrash size={14} />
          {t("cart.remove")}
        </button>
      </form>
    </div>
  );
}
