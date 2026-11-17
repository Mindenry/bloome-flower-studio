import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProfileForm } from "@/components/account-forms";
import { getCurrentUser } from "@/lib/auth/session";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  return (
    <div>
      <h2 className="text-xl">{t("account.profile")}</h2>
      <div className="card mt-4 p-6">
        <ProfileForm
          locale={locale}
          user={{
            name: user.name,
            phone: user.phone,
            locale: user.locale,
            marketingConsent: user.marketingConsent,
            email: user.email,
          }}
        />
      </div>
    </div>
  );
}
