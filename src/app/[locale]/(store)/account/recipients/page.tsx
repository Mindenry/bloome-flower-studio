import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RecipientForm } from "@/components/account-forms";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deleteRecipientAction } from "@/app/actions/account";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { firstParam } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function RecipientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const editId = firstParam(await searchParams, "edit");

  const recipients = await db
    .selectFrom("recipients")
    .selectAll()
    .where("user_id", "=", user.id)
    .where("deleted_at", "is", null)
    .orderBy("created_at", "asc")
    .execute();
  const editing = editId ? recipients.find((item) => item.id === editId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl">{t("account.recipients")}</h2>
        <Link href={`/${locale}/account/recipients`} className="btn btn-outline btn-sm">
          {t("account.addRecipient")}
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {recipients.length === 0 ? (
          <p className="border border-line bg-white px-5 py-8 text-sm text-muted md:col-span-2">{t("common.empty")}</p>
        ) : (
          recipients.map((recipient) => (
            <div key={recipient.id} className="card p-5 text-sm">
              <p className="font-medium">{recipient.name}</p>
              <p className="text-muted">{recipient.phone}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {recipient.address_line} {recipient.subdistrict} {recipient.district} {recipient.province} {recipient.postal_code}
              </p>
              {recipient.birthday ? (
                <p className="mt-2 text-[11px] text-muted">🎂 {recipient.birthday}</p>
              ) : null}
              {recipient.note ? <p className="mt-2 text-xs text-muted">{recipient.note}</p> : null}
              <div className="mt-4 flex gap-3 text-xs">
                <Link href={`/${locale}/account/recipients?edit=${recipient.id}`} className="text-primary-dark underline underline-offset-2">
                  {t("common.edit")}
                </Link>
                <form action={deleteRecipientAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={recipient.id} />
                  <button type="submit" className="text-danger underline underline-offset-2">
                    {t("common.delete")}
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card p-6">
        <h3 className="text-lg">{t("account.addRecipient")}</h3>
        <div className="mt-4">
          <RecipientForm
            locale={locale}
            recipient={
              editing
                ? {
                    id: editing.id,
                    name: editing.name,
                    phone: editing.phone,
                    addressLine: editing.address_line,
                    subdistrict: editing.subdistrict,
                    district: editing.district,
                    province: editing.province,
                    postalCode: editing.postal_code,
                    note: editing.note,
                    birthday: editing.birthday,
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
