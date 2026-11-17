import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AddressForm } from "@/components/account-forms";
import { Badge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deleteAddressAction } from "@/app/actions/account";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { firstParam } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AddressesPage({
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
  const editId = firstParam(sp, "edit");

  const addresses = await db
    .selectFrom("addresses")
    .selectAll()
    .where("user_id", "=", user.id)
    .where("deleted_at", "is", null)
    .orderBy("is_default", "desc")
    .orderBy("created_at", "asc")
    .execute();

  const editing = editId ? addresses.find((address) => address.id === editId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl">{t("account.addresses")}</h2>
        <Link href={`/${locale}/account/addresses`} className="btn btn-outline btn-sm">
          {t("account.addAddress")}
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {addresses.length === 0 ? (
          <p className="border border-line bg-white px-5 py-8 text-sm text-muted md:col-span-2">{t("common.empty")}</p>
        ) : (
          addresses.map((address) => (
            <div key={address.id} className="card p-5 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{address.label}</p>
                {address.is_default === 1 ? <Badge tone="primary">{t("account.defaultAddress")}</Badge> : null}
              </div>
              <p className="mt-2 font-medium">{address.recipient_name}</p>
              <p className="text-muted">{address.phone}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {address.address_line} {address.subdistrict} {address.district} {address.province} {address.postal_code}
              </p>
              <div className="mt-4 flex gap-3 text-xs">
                <Link href={`/${locale}/account/addresses?edit=${address.id}`} className="text-primary-dark underline underline-offset-2">
                  {t("common.edit")}
                </Link>
                <form action={deleteAddressAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={address.id} />
                  <button type="submit" className="text-danger underline underline-offset-2">
                    {t("common.delete")}
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card p-6">
        <h3 className="text-lg">{editing ? t("account.editAddress") : t("account.addAddress")}</h3>
        <div className="mt-4">
          <AddressForm
            locale={locale}
            address={
              editing
                ? {
                    id: editing.id,
                    label: editing.label,
                    recipientName: editing.recipient_name,
                    phone: editing.phone,
                    addressLine: editing.address_line,
                    subdistrict: editing.subdistrict,
                    district: editing.district,
                    province: editing.province,
                    postalCode: editing.postal_code,
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  );
}
