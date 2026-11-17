/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { sql, type SelectQueryBuilder } from "kysely";
import type { Database } from "@/lib/db/schema";
import { AdminPageHeader, AdminTable } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatMoney } from "@/lib/money";
import { firstParam, type RawSearchParams } from "@/lib/shop-params";
import {
  archiveProductAction,
  bulkProductAction,
  duplicateProductAction,
  restoreProductAction,
  togglePublishAction,
} from "@/app/actions/admin-products";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.PRODUCT_VIEW);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const sp = await searchParams;
  const query = firstParam(sp, "q")?.trim() ?? "";
  const status = firstParam(sp, "status") ?? "";
  const page = Math.max(1, Number(firstParam(sp, "page") ?? 1) || 1);
  const perPage = 20;

  const filters = (qb: SelectQueryBuilder<Database, "products", unknown>) => {
    let queryBuilder = qb;
    if (status) queryBuilder = queryBuilder.where("products.status", "=", status);
    if (query) {
      const term = `%${query.toLowerCase()}%`;
      queryBuilder = queryBuilder.where((eb) =>
        eb.or([
          eb(sql`lower(products.sku)`, "like", term),
          eb(
            "products.id",
            "in",
            db
              .selectFrom("product_translations")
              .select("product_id")
              .where(sql`lower(name)`, "like", term),
          ),
        ]),
      );
    }
    return queryBuilder;
  };

  const total = await filters(db.selectFrom("products"))
    .select(({ fn }) => fn.countAll<string>().as("count"))
    .executeTakeFirst();

  const products = await filters(db.selectFrom("products"))
    .leftJoin("product_translations as th", (join) =>
      join.onRef("th.product_id", "=", "products.id").on("th.locale", "=", "th"),
    )
    .select([
      "products.id",
      "products.sku",
      "products.slug",
      "products.status",
      "products.price",
      "products.sale_price",
      "products.stock_quantity",
      "products.low_stock_threshold",
      "products.sold_count",
      "products.updated_at",
      sql<string | null>`(select url from product_images where product_id = products.id order by sort_order asc limit 1)`.as("image_url"),
      "th.name as name_th",
    ])
    .orderBy("products.updated_at", "desc")
    .limit(perPage)
    .offset((page - 1) * perPage)
    .execute();

  const totalCount = Number(total?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  return (
    <div>
      <AdminPageHeader
        title={t("admin.products")}
        description={`${totalCount} ${t("common.results")}`}
        actions={
          <>
            <Link href={`/${locale}/admin/products/new`} className="btn btn-primary btn-sm">
              {t("admin.addProduct")}
            </Link>
              <a href="/api/admin/export?type=products" className="btn btn-ghost btn-sm">
              {t("admin.exportCsv")}
            </a>
          </>
        }
      />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={query} placeholder={t("common.search")} className="input h-9 max-w-xs text-xs" />
        <select name="status" defaultValue={status} className="input h-9 w-auto text-xs">
          <option value="">{t("common.all")}</option>
          <option value="draft">{t("status.draft")}</option>
          <option value="published">{t("status.published")}</option>
          <option value="archived">{t("status.archived")}</option>
        </select>
        <button type="submit" className="btn btn-ghost btn-sm">
          {t("common.search")}
        </button>
      </form>

      <form action={bulkProductAction}>
        <input type="hidden" name="locale" value={locale} />
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select name="bulkAction" className="input h-8 w-auto text-[11px]">
            <option value="publish">{t("common.publish")}</option>
            <option value="unpublish">{t("common.unpublish")}</option>
            <option value="archive">{t("admin.archive")}</option>
          </select>
          <button type="submit" className="btn btn-ghost btn-sm">
            {t("admin.apply")}
          </button>
          <span className="text-[11px] text-muted">{t("admin.bulkActions")}</span>
        </div>

        <AdminTable
          head={["", locale === "th" ? "สินค้า" : "Product", "SKU", t("common.price"), t("common.quantity"), t("common.status"), ""]}
        >
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-[#faf9f5]">
              <td className="px-3 py-2.5">
                <input type="checkbox" name="productIds" value={product.id} className="accent-[#81917B]" aria-label={product.sku} />
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative h-10 w-8 shrink-0 overflow-hidden bg-[#f1eee7]">
                    {product.image_url ? <Image src={product.image_url} alt="" fill sizes="32px" className="object-cover" /> : null}
                  </div>
                  <Link href={`/${locale}/admin/products/${product.id}`} className="hover:text-primary-dark">
                    {product.name_th ?? product.slug}
                  </Link>
                </div>
              </td>
              <td className="px-3 py-2.5 font-mono text-[10px]">{product.sku}</td>
              <td className="px-3 py-2.5">
                {formatMoney(product.sale_price ?? product.price, { locale })}
                {product.sale_price ? (
                  <span className="ml-1 text-[10px] text-muted line-through">{formatMoney(product.price, { locale })}</span>
                ) : null}
              </td>
              <td className={`px-3 py-2.5 ${product.stock_quantity <= 0 ? "text-danger" : product.stock_quantity <= product.low_stock_threshold ? "text-warning" : ""}`}>
                {product.stock_quantity}
              </td>
              <td className="px-3 py-2.5">
                <span className="text-[11px]">{t(`status.${product.status}` as never)}</span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2 text-[11px]">
                  <Link href={`/${locale}/admin/products/${product.id}`} className="text-primary-dark underline underline-offset-2">
                    {t("common.edit")}
                  </Link>
                  <Link href={`/${locale}/product/${product.slug}`} target="_blank" className="text-muted underline underline-offset-2">
                    {t("common.preview")}
                  </Link>
                </div>
              </td>
            </tr>
          ))}
          {products.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-xs text-muted">
                {t("common.empty")}
              </td>
            </tr>
          ) : null}
        </AdminTable>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px]">
        {products.map((product) => (
          <span key={product.id} className="flex items-center gap-2 border border-line bg-white px-2 py-1">
            <span className="font-mono">{product.sku}</span>
            <form action={togglePublishAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="productId" value={product.id} />
              <button type="submit" className="text-primary-dark underline underline-offset-2">
                {product.status === "published" ? t("common.unpublish") : t("common.publish")}
              </button>
            </form>
            <form action={duplicateProductAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="productId" value={product.id} />
              <button type="submit" className="text-muted underline underline-offset-2">
                {t("admin.duplicate")}
              </button>
            </form>
            {product.status === "archived" ? (
              <form action={restoreProductAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="productId" value={product.id} />
                <button type="submit" className="text-muted underline underline-offset-2">
                  {t("admin.restore")}
                </button>
              </form>
            ) : (
              <form action={archiveProductAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="productId" value={product.id} />
                <button type="submit" className="text-danger underline underline-offset-2">
                  {t("admin.archive")}
                </button>
              </form>
            )}
          </span>
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="mt-5 flex items-center gap-2 text-[11px]">
          {Array.from({ length: totalPages }).slice(0, 20).map((_, index) => (
            <Link
              key={index}
              href={`/${locale}/admin/products?page=${index + 1}${query ? `&q=${encodeURIComponent(query)}` : ""}${status ? `&status=${status}` : ""}`}
              className={`flex h-7 min-w-7 items-center justify-center border px-2 ${
                page === index + 1 ? "border-primary bg-primary text-white" : "border-line bg-white"
              }`}
            >
              {index + 1}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
