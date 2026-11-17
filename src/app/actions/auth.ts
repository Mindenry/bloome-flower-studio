"use server";

import { redirect } from "next/navigation";
import { loginSchema, registerSchema, resetPasswordSchema, type FormState } from "@/lib/schemas";
import { authenticate, registerUser, requestPasswordReset, resetPassword, issueVerification, verifyEmailToken } from "@/lib/auth/service";
import { destroyCurrentSession, getCurrentUser, getOrCreateGuestToken } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { asLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";

function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

function mapFieldErrors(locale: Locale, issues: Array<{ path: (string | number)[]; message: string }>) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_form";
    fieldErrors[key] = translate(locale, issue.message as never);
  }
  return fieldErrors;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors: mapFieldErrors(locale, parsed.error.issues) };
  }

  const guestToken = await getOrCreateGuestToken();
  const result = await authenticate(parsed.data, guestToken);
  if (!result.ok) return { ok: false, error: translate(locale, result.error as never) };

  const next = safeNext(formData.get("next"), `/${locale}/account`);
  redirect(next);
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    acceptTerms: formData.get("acceptTerms") === "true",
    marketingConsent: formData.get("marketingConsent") === "true",
    locale,
  });
  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors: mapFieldErrors(locale, parsed.error.issues) };
  }

  const guestToken = await getOrCreateGuestToken();
  const result = await registerUser(
    {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || undefined,
      password: parsed.data.password,
      marketingConsent: parsed.data.marketingConsent,
      locale,
    },
    guestToken,
  );
  if (!result.ok) return { ok: false, error: translate(locale, result.error as never) };

  redirect(`/${locale}/account?welcome=1`);
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await destroyCurrentSession();
  redirect(`/${locale}`);
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: translate(locale, "validation.email"), fieldErrors: { email: translate(locale, "validation.email") } };
  }
  await requestPasswordReset(email, locale);
  return { ok: true, message: translate(locale, "auth.reset.sent") };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors: mapFieldErrors(locale, parsed.error.issues) };
  }
  const result = await resetPassword(parsed.data.token, parsed.data.password);
  if (!result.ok) return { ok: false, error: translate(locale, result.error as never) };
  redirect(`/${locale}/login?reset=1`);
}

export async function resendVerificationAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`verify:${user.id}:${ip}`, 3, 3600);
  if (limit.ok) await issueVerification(user.id, locale);
  redirect(`/${locale}/account?verified=sent`);
}

export async function confirmEmailAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const token = String(formData.get("token") ?? "");
  const result = await verifyEmailToken(token);
  redirect(`/${locale}/verify-email?status=${result.ok ? "success" : "invalid"}`);
}
