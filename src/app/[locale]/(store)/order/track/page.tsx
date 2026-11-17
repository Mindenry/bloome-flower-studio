import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TrackOrderForm } from "@/components/track-order-form";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { firstParam } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: true, follow: true } };

export default async function TrackOrderPage({
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
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <div className="container-page py-14 md:py-20">
      <div className="mx-auto max-w-md">
        <p className="eyebrow text-center">{t("order.track.title")}</p>
        <h1 className="mt-3 text-center text-[30px]">{t("order.track.title")}</h1>
        <p className="mt-3 text-center text-sm text-muted">{t("order.track.hint")}</p>
        <div className="card mt-8 p-6">
          <TrackOrderForm defaultNumber={firstParam(sp, "number") ?? ""} />
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          {locale === "th" ? "มีบัญชีอยู่แล้ว?" : "Have an account?"}{" "}
          <Link href={`/${locale}/login`} className="text-primary-dark underline underline-offset-2">
            {t("nav.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
