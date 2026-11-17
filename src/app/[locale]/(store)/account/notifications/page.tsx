import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { markNotificationsReadAction } from "@/app/actions/account";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function NotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const notifications = await db
    .selectFrom("notifications")
    .selectAll()
    .where("user_id", "=", user.id)
    .orderBy("created_at", "desc")
    .limit(80)
    .execute();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl">{t("account.notifications")}</h2>
        <form action={markNotificationsReadAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="text-xs text-primary-dark underline underline-offset-2">
            {t("account.markAllRead")}
          </button>
        </form>
      </div>

      <div className="card mt-4">
        {notifications.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">{t("account.noNotifications")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {notifications.map((notification) => (
              <li key={notification.id} className={`px-5 py-4 ${notification.read_at ? "" : "bg-primary-soft/50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm">{locale === "th" ? notification.title_th : notification.title_en}</p>
                    {notification.body_th || notification.body_en ? (
                      <p className="mt-1 text-xs text-muted">
                        {locale === "th" ? notification.body_th : notification.body_en}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted">
                    {formatDateTime(notification.created_at, locale)}
                  </span>
                </div>
                {notification.link_url ? (
                  <Link href={notification.link_url} className="mt-2 inline-block text-xs text-primary-dark underline underline-offset-2">
                    {locale === "th" ? "ดูรายละเอียด" : "View details"}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
