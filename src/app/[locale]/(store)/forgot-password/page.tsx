import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <AuthShell locale={locale} title={t("auth.reset.title")} subtitle={t("auth.reset.subtitle")} imageIndex={9}>
      <ForgotPasswordForm locale={locale} />
      <p className="mt-6 text-center text-xs text-muted">
        <Link href={`/${locale}/login`} className="text-primary-dark underline underline-offset-2">
          ← {t("auth.loginCta")}
        </Link>
      </p>
    </AuthShell>
  );
}
