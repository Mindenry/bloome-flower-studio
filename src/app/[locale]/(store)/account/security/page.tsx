import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/account-forms";
import { Alert, Badge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { db, nowIso } from "@/lib/db";
import { linkedProviders } from "@/lib/auth/oauth";
import { deleteMyAccountAction, revokeOtherSessionsAction, unlinkProviderAction } from "@/app/actions/account";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/time";
import { env } from "@/lib/env";
import { firstParam } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SecurityPage({
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
  const sp = await searchParams;

  const [sessions, accounts, userRow] = await Promise.all([
    db
      .selectFrom("sessions")
      .selectAll()
      .where("user_id", "=", user.id)
      .where("revoked_at", "is", null)
      .where("expires_at", ">", nowIso())
      .orderBy("last_used_at", "desc")
      .execute(),
    linkedProviders(user.id),
    db.selectFrom("users").select(["password_hash"]).where("id", "=", user.id).executeTakeFirst(),
  ]);

  const hasPassword = Boolean(userRow?.password_hash);
  const hasLine = accounts.some((account) => account.provider === "line");
  const hasGoogle = accounts.some((account) => account.provider === "google");

  return (
    <div className="space-y-6">
      <h2 className="text-xl">{t("account.security")}</h2>

      {firstParam(sp, "linked") ? (
        <Alert tone="success">{t("auth.accountLinked")}</Alert>
      ) : null}
      {firstParam(sp, "revoked") === "1" ? (
        <Alert tone="success">{t("account.revoked")}</Alert>
      ) : null}
      {firstParam(sp, "deleteError") === "1" ? (
        <Alert tone="danger">{locale === "th" ? "พิมพ์ DELETE เพื่อยืนยัน" : "Type DELETE to confirm."}</Alert>
      ) : null}

      <section className="card p-6">
        <h3 className="text-lg">{t("account.changePassword")}</h3>
        {hasPassword ? (
          <div className="mt-4">
            <ChangePasswordForm locale={locale} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("account.passwordOAuthNote")}</p>
        )}
      </section>

      <section className="card p-6">
        <h3 className="text-lg">{t("account.sessions")}</h3>
        <ul className="mt-4 divide-y divide-line text-xs">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="text-sm">
                  {session.user_agent?.slice(0, 70) ?? "Unknown device"}
                  {session.id === user.sessionId ? <Badge tone="primary">{locale === "th" ? "อุปกรณ์นี้" : "This device"}</Badge> : null}
                </p>
                <p className="mt-0.5 text-muted">
                  {session.ip ?? "—"} · {formatDateTime(session.last_used_at, locale)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <form action={revokeOtherSessionsAction} className="mt-4">
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="btn btn-ghost btn-sm">
            {t("account.revokeOthers")}
          </button>
        </form>
      </section>

      <section className="card p-6">
        <h3 className="text-lg">{locale === "th" ? "ช่องทางเข้าสู่ระบบ" : "Sign-in methods"}</h3>
        <ul className="mt-4 space-y-3 text-sm">
          <li className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <span>LINE</span>
            {hasLine ? (
              <form action={unlinkProviderAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="provider" value="line" />
                <button type="submit" className="text-xs text-danger underline underline-offset-2">
                  {locale === "th" ? "ยกเลิกการเชื่อม" : "Unlink"}
                </button>
              </form>
            ) : env.line.configured ? (
              <a href={`/api/auth/line/start?link=1`} className="btn btn-ghost btn-sm">
                {locale === "th" ? "เชื่อม LINE" : "Link LINE"}
              </a>
            ) : (
              <Badge tone="neutral">{t("admin.notConfigured")}</Badge>
            )}
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <span>Google</span>
            {hasGoogle ? (
              <form action={unlinkProviderAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="provider" value="google" />
                <button type="submit" className="text-xs text-danger underline underline-offset-2">
                  {locale === "th" ? "ยกเลิกการเชื่อม" : "Unlink"}
                </button>
              </form>
            ) : env.google.configured ? (
              <a href={`/api/auth/google/start?link=1`} className="btn btn-ghost btn-sm">
                {locale === "th" ? "เชื่อม Google" : "Link Google"}
              </a>
            ) : (
              <Badge tone="neutral">{t("admin.notConfigured")}</Badge>
            )}
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("auth.email")}</span>
            <span className="text-xs text-muted">{user.email ?? "—"}</span>
          </li>
        </ul>
      </section>

      <section className="border border-[#f0d6d0] bg-[#fdf7f6] p-6">
        <h3 className="text-lg text-danger">{t("account.deleteAccount")}</h3>
        <p className="mt-2 text-xs leading-relaxed text-muted">{t("account.deleteWarning")}</p>
        <form action={deleteMyAccountAction} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input
            name="confirmation"
            placeholder="DELETE"
            className="input max-w-[160px] font-mono uppercase"
            required
            aria-label={t("account.deleteAccount")}
          />
          <button type="submit" className="btn btn-sm border-danger text-danger hover:bg-danger hover:text-white">
            {t("account.deleteAccount")}
          </button>
        </form>
        <p className="mt-3 text-[11px] text-muted">
          <Link href={`/${locale}/policies/privacy-policy`} className="underline underline-offset-2">
            {t("footer.privacy")}
          </Link>
        </p>
      </section>
    </div>
  );
}
