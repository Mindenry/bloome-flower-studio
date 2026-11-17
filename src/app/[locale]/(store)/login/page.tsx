import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm, SocialButtons } from "@/components/auth-forms";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { firstParam } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function LoginPage({
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
  const sp = await searchParams;
  const nextParam = firstParam(sp, "next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : `/${locale}/account`;
  if (user) redirect(next);

  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const socialConfigured = env.line.configured || env.google.configured;

  return (
    <AuthShell locale={locale} title={t("auth.login.title")} subtitle={t("auth.login.subtitle")} imageIndex={4}>
      {firstParam(sp, "reset") === "1" ? (
        <div role="status" className="mb-4 border border-[#d7e6da] bg-[#eef5f0] px-4 py-3 text-sm text-success">
          {t("auth.reset.success")}
        </div>
      ) : null}
      {socialConfigured ? (
        <>
          <SocialButtons locale={locale} next={next} />
          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-muted">
            <span className="h-px flex-1 bg-line" />
            {t("auth.or")}
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}
      <LoginForm locale={locale} next={next} />
      <p className="mt-6 text-center text-xs text-muted">
        {t("auth.noAccount")}{" "}
        <Link href={`/${locale}/register`} className="text-primary-dark underline underline-offset-2">
          {t("auth.registerCta")}
        </Link>
      </p>
    </AuthShell>
  );
}
