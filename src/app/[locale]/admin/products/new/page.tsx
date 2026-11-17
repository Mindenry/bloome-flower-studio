import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/product-form";
import { emptyProductValues, listCategoryOptions } from "@/lib/admin/products";
import { requirePermission, can } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function NewProductPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const user = await requirePermission(locale, PERMISSIONS.PRODUCT_CREATE);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const categories = await listCategoryOptions(locale);
  const sellable = categories.filter((category) => category.kind !== "occasion");
  const occasions = categories.filter((category) => category.kind === "occasion");

  return (
    <div>
      <AdminPageHeader
        title={t("admin.addProduct")}
        description={locale === "th" ? "สร้างสินค้าใหม่และเผยแพร่เมื่อพร้อม" : "Create a new product and publish when ready."}
        actions={
          <Link href={`/${locale}/admin/products`} className="btn btn-ghost btn-sm">
            {t("common.back")}
          </Link>
        }
      />
      <ProductForm
        locale={locale}
        categories={sellable.map((category) => ({ id: category.id, name: category.name }))}
        occasions={occasions.map((category) => ({ id: category.id, name: category.name }))}
        selectedOccasions={[]}
        product={emptyProductValues(sellable[0]?.id ?? "")}
        images={[]}
        showCost={can(user, PERMISSIONS.SETTINGS_MANAGE) || user.role.slug === "super_admin"}
      />
    </div>
  );
}
