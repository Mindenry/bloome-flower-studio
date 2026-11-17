"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "@/app/actions/auth";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "./i18n-provider";
import { IconLine } from "./icons";

const initial: FormState = { ok: false };

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="border border-[#f0d6d0] bg-[#fdf0ed] px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="field-error">{message}</p>;
}

export function SocialButtons({ locale, next }: { locale: string; next?: string }) {
  const { t } = useI18n();
  const lineHref = `/api/auth/line/start?next=${encodeURIComponent(next ?? `/${locale}/account`)}`;
  const googleHref = `/api/auth/google/start?next=${encodeURIComponent(next ?? `/${locale}/account`)}`;
  return (
    <div className="space-y-2">
      <a href={lineHref} className="btn w-full bg-[#06C755] text-white hover:bg-[#05b34c]">
        <IconLine size={18} />
        {t("auth.withLine")}
      </a>
      <a href={googleHref} className="btn btn-ghost w-full">
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.5 1.2 8.9 3.5l6.6-6.6C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.7 6C12.2 13.3 17.6 9.5 24 9.5Z" />
          <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v8.4h12.5c-.3 2.1-1.6 5.2-4.7 7.3l7.4 5.7c4.4-4 6.9-10 6.9-17.3Z" />
          <path fill="#FBBC05" d="M10.3 28.8a14.5 14.5 0 0 1 0-9.6l-7.7-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.7-6Z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2 1.4-4.7 2.4-8.5 2.4-6.4 0-11.8-3.8-13.7-9.1l-7.7 6C6.5 42.6 14.6 48 24 48Z" />
        </svg>
        {t("auth.withGoogle")}
      </a>
    </div>
  );
}

export function LoginForm({ locale, next }: { locale: string; next?: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next ?? `/${locale}/account`} />
      <div>
        <label className="label" htmlFor="login-email">{t("auth.email")}</label>
        <input id="login-email" name="email" type="email" required autoComplete="email" className="input" />
        <FieldError message={state.fieldErrors?.email} />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="login-password">{t("auth.password")}</label>
          <Link href={`/${locale}/forgot-password`} className="mb-1.5 text-[11px] text-primary-dark underline underline-offset-2">
            {t("auth.forgot")}
          </Link>
        </div>
        <input id="login-password" name="password" type="password" required autoComplete="current-password" className="input" />
        <FieldError message={state.fieldErrors?.password} />
      </div>
      <ErrorBox message={state.error} />
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? t("common.loading") : t("auth.loginCta")}
      </button>
    </form>
  );
}

export function RegisterForm({ locale }: { locale: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(registerAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label className="label" htmlFor="reg-name">{t("auth.name")}</label>
        <input id="reg-name" name="name" required autoComplete="name" className="input" />
        <FieldError message={state.fieldErrors?.name} />
      </div>
      <div>
        <label className="label" htmlFor="reg-email">{t("auth.email")}</label>
        <input id="reg-email" name="email" type="email" required autoComplete="email" className="input" />
        <FieldError message={state.fieldErrors?.email} />
      </div>
      <div>
        <label className="label" htmlFor="reg-phone">
          {t("auth.phone")} <span className="normal-case tracking-normal">({t("common.optional")})</span>
        </label>
        <input id="reg-phone" name="phone" inputMode="tel" autoComplete="tel" className="input" />
        <FieldError message={state.fieldErrors?.phone} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="reg-password">{t("auth.password")}</label>
          <input id="reg-password" name="password" type="password" required autoComplete="new-password" className="input" />
          <FieldError message={state.fieldErrors?.password} />
        </div>
        <div>
          <label className="label" htmlFor="reg-confirm">{t("auth.confirmPassword")}</label>
          <input id="reg-confirm" name="confirmPassword" type="password" required autoComplete="new-password" className="input" />
          <FieldError message={state.fieldErrors?.confirmPassword} />
        </div>
      </div>
      <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <input type="checkbox" name="acceptTerms" value="true" required className="mt-0.5 accent-[#81917B]" />
        <span>{t("auth.consent")}</span>
      </label>
      <FieldError message={state.fieldErrors?.acceptTerms} />
      <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
        <input type="checkbox" name="marketingConsent" value="true" className="mt-0.5 accent-[#81917B]" />
        <span>{t("auth.marketing")}</span>
      </label>
      <ErrorBox message={state.error} />
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? t("common.loading") : t("auth.registerCta")}
      </button>
    </form>
  );
}

export function ForgotPasswordForm({ locale }: { locale: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label className="label" htmlFor="forgot-email">{t("auth.email")}</label>
        <input id="forgot-email" name="email" type="email" required autoComplete="email" className="input" />
        <FieldError message={state.fieldErrors?.email} />
      </div>
      {state.ok ? (
        <div role="status" className="border border-[#d7e6da] bg-[#eef5f0] px-4 py-3 text-sm text-success">
          {state.message}
        </div>
      ) : null}
      <ErrorBox message={state.error} />
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? t("common.loading") : t("auth.reset.cta")}
      </button>
    </form>
  );
}

export function ResetPasswordForm({ locale, token }: { locale: string; token: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(resetPasswordAction, initial);
  const [visible, setVisible] = useState(false);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="reset-password">{t("auth.reset.newPassword")}</label>
        <input
          id="reset-password"
          name="password"
          type={visible ? "text" : "password"}
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
        <FieldError message={state.fieldErrors?.password} />
      </div>
      <div>
        <label className="label" htmlFor="reset-confirm">{t("auth.confirmPassword")}</label>
        <input
          id="reset-confirm"
          name="confirmPassword"
          type={visible ? "text" : "password"}
          required
          autoComplete="new-password"
          className="input"
        />
        <FieldError message={state.fieldErrors?.confirmPassword} />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} className="accent-[#81917B]" />
        {locale === "th" ? "แสดงรหัสผ่าน" : "Show password"}
      </label>
      <ErrorBox message={state.error} />
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? t("common.loading") : t("common.save")}
      </button>
    </form>
  );
}
