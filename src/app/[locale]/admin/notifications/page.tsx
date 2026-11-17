import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/ui";
import { BroadcastForm } from "@/components/admin/content-forms";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/time";
import { markAdminNotificationsReadAction } from "@/app/actions/admin-marketing";
import { Badge } from "@/components/ui";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminNotificationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.NOTIFICATION_MANAGE);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const notifications = await db
    .selectFrom("notifications")
    .selectAll()
    .where("audience", "=", "admin")
    .orderBy("created_at", "desc")
    .limit(60)
    .execute();

  return (
    <div>
      <AdminPageHeader
        title={t("admin.notifications")}
        description={locale === "th" ? "แจ้งเตือนภายในและข้อความถึงลูกค้า" : "Internal alerts and customer broadcasts."}
        actions={
          <form action={markAdminNotificationsReadAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="btn btn-ghost btn-sm">
              {t("account.markAllRead")}
            </button>
          </form>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <section className="border border-line bg-white p-4">
          <h2 className="mb-3 text-sm font-medium">{locale === "th" ? "ส่งข้อความถึงลูกค้า" : "Broadcast to customers"}</h2>
          <BroadcastForm locale={locale} />
        </section>

        <section className="border border-line bg-white">
          <h2 className="border-b border-line px-4 py-3 text-sm font-medium">{locale === "th" ? "กล่องแจ้งเตือน" : "Inbox"}</h2>
          <ul className="divide-y divide-line">
            {notifications.map((notification) => (
              <li key={notification.id} className={`px-4 py-3 ${notification.read_at ? "" : "bg-primary-soft/50"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px]">{locale === "th" ? notification.title_th : notification.title_en}</p>
                    <p className="text-[11px] text-muted">{locale === "th" ? notification.body_th : notification.body_en}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone={notification.type === "broadcast_sent" ? "neutral" : "primary"}>{notification.type}</Badge>
                    <p className="mt-1 text-[10px] text-muted">{formatDateTime(notification.created_at, locale)}</p>
                  </div>
                </div>
              </li>
            ))}
            {notifications.length === 0 ? <li className="px-4 py-8 text-center text-xs text-muted">{t("account.noNotifications")}</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
