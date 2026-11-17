import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReminderForm } from "@/components/account-forms";
import { Badge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deleteReminderAction } from "@/app/actions/account";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/time";
import { firstParam } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function RemindersPage({
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

  const reminders = await db
    .selectFrom("occasion_reminders")
    .selectAll()
    .where("user_id", "=", user.id)
    .orderBy("event_date", "asc")
    .execute();
  const editing = editId ? reminders.find((item) => item.id === editId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl">{t("account.reminders")}</h2>
        <Link href={`/${locale}/account/reminders`} className="btn btn-outline btn-sm">
          {t("account.addReminder")}
        </Link>
      </div>
      <p className="-mt-3 text-xs text-muted">{t("account.reminderHint")}</p>

      <div className="card">
        {reminders.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">{t("common.empty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm">
                    {reminder.recipient_name}
                    <span className="ml-2 text-[11px] text-muted">
                      {reminder.occasion === "birthday"
                        ? locale === "th" ? "วันเกิด" : "Birthday"
                        : reminder.occasion === "anniversary"
                          ? locale === "th" ? "วันครบรอบ" : "Anniversary"
                          : reminder.occasion === "wedding_anniversary"
                            ? locale === "th" ? "วันครบรอบแต่งงาน" : "Wedding anniversary"
                            : locale === "th" ? "วันสำคัญ" : "Special date"}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatDate(`${reminder.event_date}T12:00:00+07:00`, locale, { dateStyle: "long" })} ·{" "}
                    {locale === "th"
                      ? `แจ้งเตือน ${reminder.remind_days_before} วันก่อน`
                      : `${reminder.remind_days_before} days before`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={reminder.active === 1 ? "success" : "neutral"}>
                    {reminder.active === 1 ? t("status.active") : t("status.inactive")}
                  </Badge>
                  <Link href={`/${locale}/account/reminders?edit=${reminder.id}`} className="text-xs text-primary-dark underline underline-offset-2">
                    {t("common.edit")}
                  </Link>
                  <form action={deleteReminderAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={reminder.id} />
                    <button type="submit" className="text-xs text-danger underline underline-offset-2">
                      {t("common.delete")}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-6">
        <h3 className="text-lg">{t("account.addReminder")}</h3>
        <div className="mt-4">
          <ReminderForm
            locale={locale}
            reminder={
              editing
                ? {
                    id: editing.id,
                    recipientName: editing.recipient_name,
                    occasion: editing.occasion,
                    eventDate: editing.event_date,
                    remindDaysBefore: editing.remind_days_before,
                    notifyEmail: editing.notify_email === 1,
                    notifyLine: editing.notify_line === 1,
                    note: editing.note,
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
