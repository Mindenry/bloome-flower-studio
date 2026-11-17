import nodemailer from "nodemailer";
import { db, nowIso } from "@/lib/db";
import { env } from "@/lib/env";
import { ids } from "@/lib/ids";
import { getSettings } from "@/lib/settings";
import { translate, type TranslationKey } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type SendEmailInput = {
  to: string;
  template: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const now = nowIso();
  try {
    if (env.mail.driver === "smtp" && env.mail.host) {
      const transporter = nodemailer.createTransport({
        host: env.mail.host,
        port: env.mail.port,
        secure: env.mail.secure,
        auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
      });
      await transporter.sendMail({
        from: env.mail.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo || env.mail.replyTo || undefined,
      });
    } else {
      // Development transport: full email content is captured in the log table.
      console.log(`[mail:${input.template}] to=${input.to} subject=${input.subject}`);
    }
    await db
      .insertInto("email_log")
      .values({
        id: ids.token(),
        to_email: input.to,
        template: input.template,
        subject: input.subject,
        status: "sent",
        error: null,
        created_at: now,
      })
      .execute();
    return { ok: true };
  } catch (error) {
    const message = (error as Error).message.slice(0, 500);
    await db
      .insertInto("email_log")
      .values({
        id: ids.token(),
        to_email: input.to,
        template: input.template,
        subject: input.subject,
        status: "failed",
        error: message,
        created_at: now,
      })
      .execute()
      .catch(() => undefined);
    console.error("[mail] failed", input.template, message);
    return { ok: false, error: message };
  }
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

async function layout(locale: Locale, title: string, bodyHtml: string): Promise<string> {
  const settings = await getSettings();
  const brand = locale === "th" ? settings.store.name : settings.store.nameEn;
  return `<!doctype html>
<html lang="${locale}">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
  <body style="margin:0;padding:0;background:#F7F5EF;font-family:'Prompt','Noto Sans Thai',Arial,sans-serif;color:#292A27;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5EF;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #EAE8E1;">
          <tr><td style="padding:28px 32px 8px;text-align:center;">
            <div style="font-family:'Playfair Display',Georgia,serif;font-size:22px;letter-spacing:0.18em;color:#596B55;">${escapeHtml(brand)}</div>
            <div style="font-size:11px;letter-spacing:0.32em;color:#85867F;margin-top:6px;">FLOWER STUDIO</div>
          </td></tr>
          <tr><td style="padding:20px 32px 32px;font-size:15px;line-height:1.7;">
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:18px 32px;border-top:1px solid #EAE8E1;font-size:12px;color:#85867F;">
            ${escapeHtml(settings.store.addressEn)} · ${escapeHtml(settings.store.email)}<br>
            ${escapeHtml(brand)} · ${escapeHtml(settings.store.phone)}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:18px;padding:12px 26px;background:#81917B;color:#fff;text-decoration:none;font-size:14px;letter-spacing:0.06em;">${escapeHtml(label)}</a>`;
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                   */
/* -------------------------------------------------------------------------- */

export async function sendOrderCreatedEmail(params: {
  to: string;
  locale: Locale;
  name: string;
  orderNumber: string;
  total: number;
  paymentMethod: string;
  deliveryDate: string | null;
  deliverySlot: string | null;
}): Promise<void> {
  const subject = translate(params.locale, "email.order.subject", { orderNumber: params.orderNumber });
  const settings = await getSettings();
  const url = `${env.appUrl}/${params.locale}/order/${params.orderNumber}`;
  const body = `
    <p>${escapeHtml(translate(params.locale, "email.hello", { name: params.name }))}</p>
    <p>${escapeHtml(translate(params.locale, "checkout.stockReserved"))}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;border-top:1px solid #EAE8E1;border-bottom:1px solid #EAE8E1;margin:16px 0;">
      <tr><td style="padding:10px 0;color:#85867F;">${escapeHtml(translate(params.locale, "payment.orderNumber"))}</td><td align="right">${escapeHtml(params.orderNumber)}</td></tr>
      <tr><td style="padding:10px 0;color:#85867F;">${escapeHtml(translate(params.locale, "payment.amount"))}</td><td align="right">${escapeHtml(formatMoney(params.total, { locale: params.locale }))}</td></tr>
      ${params.deliveryDate ? `<tr><td style="padding:10px 0;color:#85867F;">${escapeHtml(translate(params.locale, "checkout.deliveryDate"))}</td><td align="right">${escapeHtml(params.deliveryDate)} ${escapeHtml(params.deliverySlot ?? "")}</td></tr>` : ""}
    </table>
    <p style="color:#85867F;font-size:13px;">${escapeHtml(settings.store.tagline)}</p>
    ${button(url, translate(params.locale, "email.viewOrder"))}
  `;
  await sendEmail({
    to: params.to,
    template: "order_created",
    subject,
    html: await layout(params.locale, subject, body),
    text: `${translate(params.locale, "email.hello", { name: params.name })}\n${params.orderNumber} ${formatMoney(params.total)}`,
  });
}

export async function sendPaymentSucceededEmail(params: {
  to: string;
  locale: Locale;
  name: string;
  orderNumber: string;
  total: number;
}): Promise<void> {
  const subject = translate(params.locale, "email.paid.subject", { orderNumber: params.orderNumber });
  const url = `${env.appUrl}/${params.locale}/order/${params.orderNumber}`;
  const body = `
    <p>${escapeHtml(translate(params.locale, "email.hello", { name: params.name }))}</p>
    <p>${escapeHtml(translate(params.locale, "payment.paid"))} — ${escapeHtml(formatMoney(params.total, { locale: params.locale }))}</p>
    <p>${escapeHtml(translate(params.locale, "email.thanks"))}</p>
    ${button(url, translate(params.locale, "email.viewOrder"))}
  `;
  await sendEmail({
    to: params.to,
    template: "payment_succeeded",
    subject,
    html: await layout(params.locale, subject, body),
    text: `${params.orderNumber} paid`,
  });
}

export async function sendStatusUpdateEmail(params: {
  to: string;
  locale: Locale;
  name: string;
  orderNumber: string;
  statusKey: TranslationKey;
}): Promise<void> {
  const subjectKey: TranslationKey = params.statusKey === "order.status.out_for_delivery" ? "email.shipped.subject" : "email.delivered.subject";
  const subject = translate(params.locale, subjectKey, { orderNumber: params.orderNumber });
  const url = `${env.appUrl}/${params.locale}/order/${params.orderNumber}`;
  const body = `
    <p>${escapeHtml(translate(params.locale, "email.hello", { name: params.name }))}</p>
    <p>${escapeHtml(translate(params.locale, params.statusKey))}</p>
    ${button(url, translate(params.locale, "email.viewOrder"))}
  `;
  await sendEmail({
    to: params.to,
    template: "order_status",
    subject,
    html: await layout(params.locale, subject, body),
    text: `${params.orderNumber} ${translate(params.locale, params.statusKey)}`,
  });
}

export async function sendVerificationEmail(params: {
  to: string;
  locale: Locale;
  name: string;
  token: string;
}): Promise<void> {
  const subject = translate(params.locale, "email.verify.subject");
  const url = `${env.appUrl}/${params.locale}/verify-email?token=${encodeURIComponent(params.token)}`;
  const body = `
    <p>${escapeHtml(translate(params.locale, "email.hello", { name: params.name }))}</p>
    <p>${escapeHtml(translate(params.locale, "auth.verify.title"))}</p>
    ${button(url, translate(params.locale, "auth.verify.title"))}
    <p style="font-size:12px;color:#85867F;margin-top:18px;">${escapeHtml(url)}</p>
  `;
  await sendEmail({
    to: params.to,
    template: "verify_email",
    subject,
    html: await layout(params.locale, subject, body),
    text: url,
  });
}

export async function sendResetEmail(params: {
  to: string;
  locale: Locale;
  name: string;
  token: string;
}): Promise<void> {
  const subject = translate(params.locale, "email.reset.subject");
  const url = `${env.appUrl}/${params.locale}/reset-password?token=${encodeURIComponent(params.token)}`;
  const body = `
    <p>${escapeHtml(translate(params.locale, "email.hello", { name: params.name }))}</p>
    <p>${escapeHtml(translate(params.locale, "auth.reset.subtitle"))}</p>
    ${button(url, translate(params.locale, "auth.reset.newPassword"))}
    <p style="font-size:12px;color:#85867F;margin-top:18px;">${escapeHtml(url)}</p>
  `;
  await sendEmail({
    to: params.to,
    template: "reset_password",
    subject,
    html: await layout(params.locale, subject, body),
    text: url,
  });
}

export async function sendNewsletterConfirmation(params: {
  to: string;
  locale: Locale;
  token: string;
}): Promise<void> {
  const subject = translate(params.locale, "email.newsletter.subject");
  const url = `${env.appUrl}/${params.locale}/newsletter/confirm?token=${encodeURIComponent(params.token)}`;
  const body = `
    <p>${escapeHtml(translate(params.locale, "home.newsletter.title"))}</p>
    ${button(url, translate(params.locale, "home.newsletter.cta"))}
  `;
  await sendEmail({
    to: params.to,
    template: "newsletter_confirm",
    subject,
    html: await layout(params.locale, subject, body),
    text: url,
  });
}

export async function sendContactEmail(params: {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}): Promise<void> {
  const settings = await getSettings();
  const subject = `[Contact] ${params.subject}`;
  const body = `
    <p><strong>${escapeHtml(params.name)}</strong> &lt;${escapeHtml(params.email)}&gt; ${escapeHtml(params.phone)}</p>
    <p>${escapeHtml(params.message).replace(/\n/g, "<br>")}</p>
  `;
  await sendEmail({
    to: settings.store.email,
    template: "contact_message",
    subject,
    html: await layout("en", subject, body),
    text: `${params.name} ${params.email}\n${params.message}`,
    replyTo: params.email,
  });
}

export async function sendRefundEmail(params: {
  to: string;
  locale: Locale;
  name: string;
  orderNumber: string;
  amount: number;
}): Promise<void> {
  const subject = `Refund processed — ${params.orderNumber}`;
  const body = `
    <p>${escapeHtml(translate(params.locale, "email.hello", { name: params.name }))}</p>
    <p>${escapeHtml(formatMoney(params.amount, { locale: params.locale }))} — ${escapeHtml(translate(params.locale, "payment.status.refunded"))}</p>
  `;
  await sendEmail({
    to: params.to,
    template: "refund_processed",
    subject,
    html: await layout(params.locale, subject, body),
    text: subject,
  });
}
