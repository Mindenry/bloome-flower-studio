import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm, SocialButtons } from "@/components/auth-forms";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}/account`);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <AuthShell locale={locale} title={t("auth.register.title")} subtitle={t("auth.register.subtitle")} imageIndex={7}>
      {env.line.configured || env.google.configured ? (
        <>
          <SocialButtons locale={locale} next={`/${locale}/account`} />
          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="h-px flex-1 bg-line" />
            {t("auth.or")}
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}
      <RegisterForm locale={locale} />
      <p className="mt-6 text-center text-xs text-muted">
        {t("auth.hasAccount")}{" "}
        <Link href={`/${locale}/login`} className="text-primary-dark underline underline-offset-2">
          {t("auth.loginCta")}
        </Link>
      </p>
    </AuthShell>
  );
}
