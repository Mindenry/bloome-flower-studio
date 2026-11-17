import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader, AdminTable } from "@/components/admin/ui";
import { CouponForm } from "@/components/admin/coupon-form";
import { Badge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { firstParam, type RawSearchParams } from "@/lib/shop-params";
import { deleteCouponAction, toggleCouponAction } from "@/app/actions/admin-marketing";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminCouponsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.COUPON_MANAGE);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const sp = await searchParams;
  const editId = firstParam(sp, "edit");

  const coupons = await db.selectFrom("coupons").selectAll().orderBy("created_at", "desc").execute();
  const usage = await db
    .selectFrom("coupon_usages")
    .select(["coupon_id", ({ fn }) => fn.countAll<string>().as("count")])
    .groupBy("coupon_id")
    .execute();
  const usageMap = new Map(usage.map((row) => [row.coupon_id, Number(row.count ?? 0)]));
  const editing = editId ? coupons.find((coupon) => coupon.id === editId) : null;

  return (
    <div>
      <AdminPageHeader
        title={t("admin.coupons")}
        description={locale === "th" ? "ส่วนลดและสิทธิประโยชน์ที่ตรวจสอบฝั่งเซิร์ฟเวอร์" : "Discounts validated server-side at checkout."}
        actions={
          <Link href={`/${locale}/admin/coupons`} className="btn btn-primary btn-sm">
            {t("common.create")}
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div>
          <AdminTable head={["Code", "Type", "Value", "Min", "Used", t("common.status"), ""]}>
            {coupons.map((coupon) => (
              <tr key={coupon.id}>
                <td className="px-3 py-2.5 font-mono text-[11px]">{coupon.code}</td>
                <td className="px-3 py-2.5 text-[11px]">{coupon.type}</td>
                <td className="px-3 py-2.5 text-[11px]">
                  {coupon.type === "percent"
                    ? `${(coupon.value / 100).toFixed(0)}%`
                    : coupon.type === "fixed"
                      ? formatMoney(coupon.value, { locale })
                      : "—"}
                </td>
                <td className="px-3 py-2.5 text-[11px]">{formatMoney(coupon.min_spend, { locale })}</td>
                <td className="px-3 py-2.5 text-[11px]">
                  {usageMap.get(coupon.id) ?? 0}
                  {coupon.usage_limit ? `/${coupon.usage_limit}` : ""}
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={coupon.status === "active" ? "success" : "neutral"}>{t(`status.${coupon.status}` as never)}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 text-[11px]">
                    <Link href={`/${locale}/admin/coupons?edit=${coupon.id}`} className="text-primary-dark underline underline-offset-2">
                      {t("common.edit")}
                    </Link>
                    <form action={toggleCouponAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={coupon.id} />
                      <button type="submit" className="text-muted underline underline-offset-2">
                        {coupon.status === "active" ? t("common.unpublish") : t("common.publish")}
                      </button>
                    </form>
                    <form action={deleteCouponAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={coupon.id} />
                      <button type="submit" className="text-danger underline underline-offset-2">
                        {t("common.delete")}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            {locale === "th"
              ? "ค่า Value ของส่วนลดแบบเปอร์เซ็นต์ใช้หน่วย basis points (1000 = 10%) และแบบจำนวนเงินใช้สตางค์ (20000 = 200 บาท)"
              : "Percent value uses basis points (1000 = 10%); fixed value uses satang (20000 = THB 200)."}
          </p>
        </div>

        <section className="border border-line bg-white p-4">
          <h2 className="text-sm font-medium">{editing ? t("common.edit") : t("common.create")}</h2>
          <div className="mt-3">
            <CouponForm
              locale={locale}
              coupon={
                editing
                  ? {
                      id: editing.id,
                      code: editing.code,
                      descriptionTh: editing.description_th ?? "",
                      descriptionEn: editing.description_en ?? "",
                      type: editing.type,
                      value: editing.value,
                      minSpend: editing.min_spend,
                      maxDiscount: editing.max_discount,
                      usageLimit: editing.usage_limit,
                      perCustomerLimit: editing.per_customer_limit,
                      startsAt: editing.starts_at,
                      endsAt: editing.ends_at ?? "",
                      status: editing.status,
                      appliesTo: editing.applies_to,
                      productIds: editing.product_ids ?? "",
                      categoryIds: editing.category_ids ?? "",
                    }
                  : undefined
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
