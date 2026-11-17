import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ResetPasswordForm } from "@/components/auth-forms";
import { Alert } from "@/components/ui";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { firstParam } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ResetPasswordPage({
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
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <AuthShell locale={locale} title={t("auth.reset.title")} subtitle={t("auth.reset.subtitle")} imageIndex={11}>
      {token ? (
        <ResetPasswordForm locale={locale} token={token} />
      ) : (
        <>
          <Alert tone="danger">{t("auth.reset.invalid")}</Alert>
          <Link href={`/${locale}/forgot-password`} className="btn btn-outline mt-5 w-full">
            {t("auth.reset.cta")}
          </Link>
        </>
      )}
    </AuthShell>
  );
}
