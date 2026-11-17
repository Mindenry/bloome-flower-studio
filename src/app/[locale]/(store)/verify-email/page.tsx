import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui";
import { confirmEmailAction } from "@/app/actions/auth";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { firstParam } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const sp = await searchParams;
  const token = firstParam(sp, "token") ?? "";
  const status = firstParam(sp, "status");
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <AuthShell locale={locale} title={t("auth.verify.title")} imageIndex={13}>
      {status === "success" ? (
        <>
          <Alert tone="success">{t("auth.verify.success")}</Alert>
          <Link href={`/${locale}/account`} className="btn btn-primary mt-5 w-full">
            {t("nav.account")}
          </Link>
        </>
      ) : status === "invalid" ? (
        <>
          <Alert tone="danger">{t("auth.verify.invalid")}</Alert>
          <Link href={`/${locale}/account`} className="btn btn-outline mt-5 w-full">
            {t("nav.account")}
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted">
            {locale === "th"
              ? "กดปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ (เราต้องการป้องกันการยืนยันจากโปรแกรมอัตโนมัติ)"
              : "Confirm your email address below (this prevents automated link scanners from verifying it)."}
          </p>
          <form action={confirmEmailAction} className="mt-5">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="btn btn-primary w-full" disabled={!token}>
              {t("auth.verify.title")}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
