import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { VariantManager } from "@/components/admin/variant-manager";
import { getProductForAdmin, listCategoryOptions } from "@/lib/admin/products";
import { requirePermission, can } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { firstParam, type RawSearchParams } from "@/lib/shop-params";
import { hardDeleteProductAction } from "@/app/actions/admin-products";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw, id } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const user = await requirePermission(locale, PERMISSIONS.PRODUCT_UPDATE);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const [product, categories, sp] = await Promise.all([getProductForAdmin(id), listCategoryOptions(locale), searchParams]);
  if (!product) notFound();

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={product.values.nameTh || t("admin.editProduct")}
        description={`SKU ${product.values.sku}`}
        actions={
          <>
            <Link href={`/${locale}/product/${product.values.slug}`} target="_blank" className="btn btn-ghost btn-sm">
              {t("common.preview")}
            </Link>
            <Link href={`/${locale}/admin/products`} className="btn btn-ghost btn-sm">
              {t("common.back")}
            </Link>
          </>
        }
      />

      {firstParam(sp, "created") === "1" ? (
        <p className="border border-[#d7e6da] bg-[#eef5f0] px-4 py-2.5 text-xs text-success">{t("common.created")}</p>
      ) : null}
      {firstParam(sp, "duplicated") === "1" ? (
        <p className="border border-[#d7e6da] bg-[#eef5f0] px-4 py-2.5 text-xs text-success">{t("admin.duplicate")}</p>
      ) : null}

      <ProductForm
        locale={locale}
        categories={categories.filter((c) => c.kind !== "occasion").map((category) => ({ id: category.id, name: category.name }))}
        occasions={categories.filter((c) => c.kind === "occasion").map((category) => ({ id: category.id, name: category.name }))}
        selectedOccasions={product.occasionIds}
        product={product.values}
        images={product.images}
        showCost={can(user, PERMISSIONS.SETTINGS_MANAGE) || user.role.slug === "super_admin"}
      />

      <VariantManager locale={locale} productId={id} variants={product.variants} />

      <section className="border border-[#f0d6d0] bg-[#fdf7f6] p-5">
        <h2 className="text-sm font-medium text-danger">{t("admin.confirmDelete")}</h2>
        <p className="mt-1 text-[11px] text-muted">
          {locale === "th"
            ? "หากสินค้าเคยถูกสั่งซื้อ ระบบจะเก็บถาวรแทนการลบ เพื่อรักษาประวัติคำสั่งซื้อ"
            : "If this product has been ordered, it is archived instead of deleted to preserve order history."}
        </p>
        <form action={hardDeleteProductAction} className="mt-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="productId" value={id} />
          <button type="submit" className="btn btn-sm border-danger text-danger hover:bg-danger hover:text-white">
            {t("common.delete")}
          </button>
        </form>
      </section>
    </div>
  );
}
