import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/ui";
import { confirmNewsletterToken } from "@/app/actions/newsletter";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { firstParam } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function NewsletterConfirmPage({
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
  const confirmed = token ? await confirmNewsletterToken(token) : false;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <AuthShell locale={locale} title={t("home.newsletter.title")} imageIndex={15}>
      {confirmed ? (
        <>
          <Alert tone="success">{t("home.newsletter.success")}</Alert>
          <Link href={`/${locale}`} className="btn btn-primary mt-5 w-full">
            {t("nav.home")}
          </Link>
        </>
      ) : (
        <>
          <Alert tone="danger">{t("auth.reset.invalid")}</Alert>
          <Link href={`/${locale}`} className="btn btn-outline mt-5 w-full">
            {t("nav.home")}
          </Link>
        </>
      )}
    </AuthShell>
  );
}
