"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, getOrCreateGuestToken } from "@/lib/auth/session";
import {
  addLine,
  evaluateCoupon,
  findActiveCart,
  getCart,
  getOrCreateCart,
  removeLine,
  setCartCoupon,
  toggleWishlist,
  updateLineQuantity,
} from "@/lib/cart";
import type { FormState } from "@/lib/schemas";
import { asLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";

function localeFrom(formData: FormData): Locale {
  return asLocale(String(formData.get("locale") ?? "th"));
}

async function cartContext(locale: Locale) {
  const user = await getCurrentUser();
  const guestToken = user ? null : await getOrCreateGuestToken();
  const cart = await getOrCreateCart(user?.id ?? null, guestToken, locale);
  return { user, cart };
}

export async function addToCartAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeFrom(formData);
  const productId = String(formData.get("productId") ?? "");
  const variantIdRaw = String(formData.get("variantId") ?? "");
  const variantId = variantIdRaw && variantIdRaw !== "none" ? variantIdRaw : null;
  const addonIds = formData.getAll("addonIds").map(String).filter(Boolean);
  const quantity = Math.min(20, Math.max(1, Number(formData.get("quantity") ?? 1) || 1));
  const buyNow = formData.get("buyNow") === "1";

  if (!productId) return { ok: false, error: "common.notFound" };

  const { cart, user } = await cartContext(locale);
  const result = await addLine({ cartId: cart.id, productId, variantId, addonIds, quantity });
  if (!result.ok) return { ok: false, error: translate(locale, result.error as never) };

  revalidatePath("/", "layout");
  if (buyNow) redirect(`/${locale}/checkout`);

  return {
    ok: true,
    message: translate(locale, "product.added"),
    data: { needsLoginForWishlist: !user },
  };
}

export async function updateCartItemAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const itemId = String(formData.get("itemId") ?? "");
  const quantity = Number(formData.get("quantity") ?? 1);
  const user = await getCurrentUser();
  const guestToken = user ? null : await getOrCreateGuestToken();
  const cart = await findActiveCart(user?.id ?? null, guestToken);
  if (!cart || !itemId) return;
  await updateLineQuantity(cart.id, itemId, quantity);
  revalidatePath("/", "layout");
  revalidatePath(`/${locale}/cart`);
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const itemId = String(formData.get("itemId") ?? "");
  const user = await getCurrentUser();
  const guestToken = user ? null : await getOrCreateGuestToken();
  const cart = await findActiveCart(user?.id ?? null, guestToken);
  if (!cart || !itemId) return;
  await removeLine(cart.id, itemId);
  revalidatePath("/", "layout");
  revalidatePath(`/${locale}/cart`);
}

export async function applyCouponAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = localeFrom(formData);
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { ok: false, error: "error.couponInvalid" };

  const user = await getCurrentUser();
  const guestToken = user ? null : await getOrCreateGuestToken();
  const cart = await findActiveCart(user?.id ?? null, guestToken);
  if (!cart) return { ok: false, error: "error.cartEmpty" };

  const view = await getCart(locale);
  const evaluation = await evaluateCoupon(
    code,
    view.items.map((item) => ({
      productId: item.productId,
      categoryId: item.categoryId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      addonsTotal: item.addonsTotal,
    })),
    { userId: user?.id ?? null, email: user?.email ?? null },
  );

  if (!evaluation.ok) {
    return { ok: false, error: translate(locale, (evaluation.error ?? "error.couponInvalid") as never) };
  }

  await setCartCoupon(cart.id, evaluation.code);
  revalidatePath("/", "layout");
  revalidatePath(`/${locale}/cart`);
  revalidatePath(`/${locale}/checkout`);
  return { ok: true, message: translate(locale, "cart.couponApplied") };
}

export async function removeCouponAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const user = await getCurrentUser();
  const guestToken = user ? null : await getOrCreateGuestToken();
  const cart = await findActiveCart(user?.id ?? null, guestToken);
  if (!cart) return;
  await setCartCoupon(cart.id, null);
  revalidatePath("/", "layout");
  revalidatePath(`/${locale}/cart`);
  revalidatePath(`/${locale}/checkout`);
}

export async function toggleWishlistAction(formData: FormData): Promise<void> {
  const locale = localeFrom(formData);
  const productId = String(formData.get("productId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? `/${locale}/shop`);
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(returnTo)}`);
  }
  if (!productId) return;
  await toggleWishlist(user.id, productId);
  revalidatePath(`/${locale}/wishlist`);
  revalidatePath(returnTo);
  revalidatePath("/", "layout");
}
