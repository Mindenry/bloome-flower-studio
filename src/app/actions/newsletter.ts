"use server";

import { headers } from "next/headers";
import { db, nowIso } from "@/lib/db";
import { ids, randomToken } from "@/lib/ids";
import { newsletterSchema, type FormState } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { sendNewsletterConfirmation } from "@/lib/email";
import { translate } from "@/lib/i18n";
import { asLocale } from "@/lib/i18n/config";

export async function subscribeNewsletterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newsletterSchema.safeParse({
    email: formData.get("email"),
    consent: formData.get("consent") === "true",
    locale: formData.get("locale") ?? "th",
  });
  const locale = asLocale(String(formData.get("locale") ?? "th"));

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      fieldErrors[key] = translate(locale, issue.message as never);
    }
    return { ok: false, error: "error.validation", fieldErrors };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`newsletter:${ip}`, 5, 3600);
  if (!limit.ok) return { ok: false, error: "error.rateLimit" };

  const email = parsed.data.email;
  const existing = await db.selectFrom("newsletter_subscribers").selectAll().where("email", "=", email).executeTakeFirst();
  if (existing?.status === "confirmed") {
    return { ok: true, message: translate(locale, "home.newsletter.exists") };
  }

  const token = randomToken(24);
  if (existing) {
    await db
      .updateTable("newsletter_subscribers")
      .set({ token, locale: parsed.data.locale, consent: 1, status: "pending", updated_at: nowIso() })
      .where("id", "=", existing.id)
      .execute();
  } else {
    await db
      .insertInto("newsletter_subscribers")
      .values({
        id: ids.newsletter(),
        email,
        locale: parsed.data.locale,
        consent: 1,
        status: "pending",
        token,
        confirmed_at: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      })
      .execute();
  }

  await sendNewsletterConfirmation({ to: email, locale: parsed.data.locale, token });
  return { ok: true, message: translate(locale, "home.newsletter.success") };
}

export async function confirmNewsletterToken(token: string): Promise<boolean> {
  if (!token) return false;
  const row = await db
    .selectFrom("newsletter_subscribers")
    .select(["id", "status"])
    .where("token", "=", token)
    .executeTakeFirst();
  if (!row) return false;
  await db
    .updateTable("newsletter_subscribers")
    .set({ status: "confirmed", confirmed_at: nowIso(), token: null, updated_at: nowIso() })
    .where("id", "=", row.id)
    .execute();
  return true;
}
