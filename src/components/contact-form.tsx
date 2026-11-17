"use client";

import { useActionState } from "react";
import { sendContactMessageAction } from "@/app/actions/contact";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "./i18n-provider";

const initial: FormState = { ok: false };

export function ContactForm() {
  const { locale, t } = useI18n();
  const [state, action, pending] = useActionState(sendContactMessageAction, initial);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="contact-name">
            {t("contact.name")}
          </label>
          <input id="contact-name" name="name" required className="input" aria-invalid={!!state.fieldErrors?.name} />
          {state.fieldErrors?.name ? <p className="field-error">{state.fieldErrors.name}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="contact-email">
            {t("contact.email")}
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            aria-invalid={!!state.fieldErrors?.email}
          />
          {state.fieldErrors?.email ? <p className="field-error">{state.fieldErrors.email}</p> : null}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="contact-phone">
            {t("contact.phone")} <span className="normal-case tracking-normal text-muted">({t("common.optional")})</span>
          </label>
          <input id="contact-phone" name="phone" inputMode="tel" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="contact-subject">
            {t("contact.subject")}
          </label>
          <input id="contact-subject" name="subject" required className="input" aria-invalid={!!state.fieldErrors?.subject} />
          {state.fieldErrors?.subject ? <p className="field-error">{state.fieldErrors.subject}</p> : null}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="contact-message">
          {t("contact.message")}
        </label>
        <textarea id="contact-message" name="message" required rows={6} className="textarea" aria-invalid={!!state.fieldErrors?.message} />
        {state.fieldErrors?.message ? <p className="field-error">{state.fieldErrors.message}</p> : null}
      </div>

      {state.error ? (
        <div role="alert" className="border border-[#f0d6d0] bg-[#fdf0ed] px-4 py-3 text-sm text-danger">
          {t(state.error as never)}
        </div>
      ) : null}
      {state.ok ? (
        <div role="status" className="border border-[#d7e6da] bg-[#eef5f0] px-4 py-3 text-sm text-success">
          {state.message ?? t("contact.sent")}
        </div>
      ) : null}

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? t("common.loading") : t("contact.send")}
      </button>
    </form>
  );
}
