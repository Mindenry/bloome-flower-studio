"use client";

import { useActionState } from "react";
import { useI18n } from "./i18n-provider";
import { subscribeNewsletterAction } from "@/app/actions/newsletter";
import type { FormState } from "@/lib/schemas";

const initialState: FormState = { ok: false };

export function NewsletterForm({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const { locale, t } = useI18n();
  const [state, formAction, pending] = useActionState(subscribeNewsletterAction, initialState);
  const light = tone === "light";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`newsletter-email-${tone}`}>
          {t("auth.email")}
        </label>
        <input
          id={`newsletter-email-${tone}`}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder={t("home.newsletter.placeholder")}
          className={
            light
              ? "h-12 w-full border sm:h-[52px] sm:flex-1 border-line bg-white px-4 text-[15px] text-charcoal outline-none transition-colors placeholder:text-[#9a9b94] focus:border-primary sm:h-[52px]"
              : "h-12 w-full border sm:h-[52px] sm:flex-1 border-white/25 bg-white/95 px-4 text-[15px] text-charcoal outline-none transition-colors placeholder:text-[#8d8e86] focus:border-white focus:bg-white sm:h-[52px]"
          }
          aria-invalid={state.fieldErrors?.email ? true : undefined}
        />
        <button
          type="submit"
          className={
            light
              ? "btn btn-primary h-12 shrink-0 px-7 sm:h-[52px]"
              : "h-12 shrink-0 bg-white px-7 text-[12px] uppercase tracking-[0.16em] text-[#2F3A2E] transition-colors hover:bg-[#F7F5EF] disabled:opacity-60 sm:h-[52px]"
          }
          disabled={pending}
        >
          {pending ? t("common.loading") : t("home.newsletter.cta")}
        </button>
      </div>
      <label className={`flex items-start gap-2 text-[11px] leading-relaxed ${light ? "text-muted" : "text-white/60"}`}>
        <input type="checkbox" name="consent" value="true" required className="mt-0.5 h-3.5 w-3.5 accent-[#81917B]" />
        <span>{t("home.newsletter.consent")}</span>
      </label>
      {state.error ? (
        <p role="alert" className={`text-xs ${light ? "text-danger" : "text-[#f3c7c0]"}`}>
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className={`text-xs ${light ? "text-success" : "text-[#d8e8d6]"}`}>
          {state.message ?? t("home.newsletter.success")}
        </p>
      ) : null}
    </form>
  );
}
