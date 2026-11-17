import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "kysely";
import { AdminPageHeader, AdminTable } from "@/components/admin/ui";
import { CategoryForm } from "@/components/admin/category-form";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { firstParam, type RawSearchParams } from "@/lib/shop-params";
import { deleteCategoryAction } from "@/app/actions/admin-categories";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminCategoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.CATEGORY_MANAGE);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const sp = await searchParams;
  const editId = firstParam(sp, "edit");

  const rows = await db
    .selectFrom("categories as c")
    .leftJoin("category_translations as th", (join) =>
      join.onRef("th.category_id", "=", "c.id").on("th.locale", "=", "th"),
    )
    .leftJoin("category_translations as en", (join) =>
      join.onRef("en.category_id", "=", "c.id").on("en.locale", "=", "en"),
    )
    .select([
      "c.id",
      "c.slug",
      "c.kind",
      "c.status",
      "c.image_url",
      "c.sort_order",
      "c.deleted_at",
      "th.name as name_th",
      "en.name as name_en",
      "th.description as desc_th",
      "en.description as desc_en",
      sql<string>`(select count(*) from products p where p.category_id = c.id and p.deleted_at is null)`.as("product_count"),
    ])
    .orderBy("c.kind", "asc")
    .orderBy("c.sort_order", "asc")
    .execute();

  const editing = editId ? rows.find((row) => row.id === editId) : null;

  return (
    <div>
      <AdminPageHeader
        title={t("admin.categories")}
        description={locale === "th" ? "หมวดหมู่ คอลเลกชัน และโอกาสพิเศษ" : "Categories, collections and occasions."}
        actions={
          <Link href={`/${locale}/admin/categories`} className="btn btn-primary btn-sm">
            {t("common.create")}
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <AdminTable head={[locale === "th" ? "ชื่อ" : "Name", "Slug", "Kind", t("common.status"), "Products", ""]}>
          {rows.map((row) => (
            <tr key={row.id} className={row.deleted_at ? "opacity-50" : ""}>
              <td className="px-3 py-2.5">
                <span className="block">{row.name_th ?? row.slug}</span>
                <span className="block text-[10px] text-muted">{row.name_en}</span>
              </td>
              <td className="px-3 py-2.5 font-mono text-[10px]">{row.slug}</td>
              <td className="px-3 py-2.5 text-[11px]">{row.kind}</td>
              <td className="px-3 py-2.5 text-[11px]">{t(`status.${row.status}` as never)}</td>
              <td className="px-3 py-2.5">{row.product_count}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2 text-[11px]">
                  <Link href={`/${locale}/admin/categories?edit=${row.id}`} className="text-primary-dark underline underline-offset-2">
                    {t("common.edit")}
                  </Link>
                  <form action={deleteCategoryAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={row.id} />
                    <button type="submit" className="text-danger underline underline-offset-2">
                      {t("common.delete")}
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>

        <section className="border border-line bg-white p-4">
          <h2 className="text-sm font-medium">{editing ? t("common.edit") : t("common.create")}</h2>
          <div className="mt-3">
            <CategoryForm
              locale={locale}
              category={
                editing
                  ? {
                      id: editing.id,
                      slug: editing.slug,
                      kind: editing.kind,
                      nameTh: editing.name_th ?? "",
                      nameEn: editing.name_en ?? "",
                      descriptionTh: editing.desc_th ?? "",
                      descriptionEn: editing.desc_en ?? "",
                      imageUrl: editing.image_url ?? "",
                      sortOrder: editing.sort_order,
                      status: editing.status,
                    }
                  : null
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
}
