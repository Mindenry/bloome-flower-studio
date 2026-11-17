"use server";

import { headers } from "next/headers";
import { contactSchema, type FormState } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { sendContactEmail } from "@/lib/email";
import { translate } from "@/lib/i18n";
import { asLocale } from "@/lib/i18n/config";

export async function sendContactMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    subject: formData.get("subject"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "_form"] = translate(locale, issue.message as never);
    }
    return { ok: false, error: "error.validation", fieldErrors };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await rateLimit(`contact:${ip}`, 4, 3600);
  if (!limit.ok) return { ok: false, error: "error.rateLimit" };

  await sendContactEmail({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? "",
    subject: parsed.data.subject,
    message: parsed.data.message,
  });

  return { ok: true, message: translate(locale, "contact.sent") };
}
