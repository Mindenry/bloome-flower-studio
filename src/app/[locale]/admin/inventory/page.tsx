import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader, AdminTable, StatCard } from "@/components/admin/ui";
import { StockForm } from "@/components/admin/stock-form";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminInventoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.INVENTORY_VIEW);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const [products, movements, batches, lowCount, outCount] = await Promise.all([
    db
      .selectFrom("products")
      .leftJoin("product_translations as th", (join) =>
        join.onRef("th.product_id", "=", "products.id").on("th.locale", "=", "th"),
      )
      .select(["products.id", "products.sku", "products.stock_quantity", "products.low_stock_threshold", "th.name as name_th"])
      .where("products.deleted_at", "is", null)
      .where("products.status", "!=", "archived")
      .orderBy("products.stock_quantity", "asc")
      .limit(200)
      .execute(),
    db
      .selectFrom("inventory_movements as m")
      .innerJoin("products as p", "p.id", "m.product_id")
      .select(["m.id", "m.type", "m.quantity", "m.note", "m.created_at", "p.sku"])
      .orderBy("m.created_at", "desc")
      .limit(25)
      .execute(),
    db.selectFrom("inventory_batches").selectAll().orderBy("created_at", "desc").limit(15).execute(),
    db
      .selectFrom("products")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("stock_quantity", ">", 0)
      .where((eb) => eb("stock_quantity", "<=", eb.ref("low_stock_threshold")))
      .executeTakeFirst(),
    db
      .selectFrom("products")
      .select(({ fn }) => fn.countAll<string>().as("count"))
      .where("stock_quantity", "<=", 0)
      .executeTakeFirst(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title={t("admin.inventory")}
        description={locale === "th" ? "สต็อก ล็อตสินค้า และความสดของดอกไม้" : "Stock levels, batches and freshness."}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("admin.lowStock")} value={String(lowCount?.count ?? 0)} tone="warning" />
        <StatCard label={t("admin.outOfStock")} value={String(outCount?.count ?? 0)} tone="danger" />
        <StatCard label={locale === "th" ? "รายการเคลื่อนไหว" : "Movements"} value={String(movements.length)} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <AdminTable head={["SKU", locale === "th" ? "สินค้า" : "Product", t("common.quantity"), t("admin.lowStock")]}>
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-3 py-2.5 font-mono text-[10px]">{product.sku}</td>
                <td className="px-3 py-2.5">{product.name_th ?? product.sku}</td>
                <td className={`px-3 py-2.5 ${product.stock_quantity <= 0 ? "text-danger" : product.stock_quantity <= product.low_stock_threshold ? "text-warning" : ""}`}>
                  {product.stock_quantity}
                </td>
                <td className="px-3 py-2.5 text-[11px] text-muted">{product.low_stock_threshold}</td>
              </tr>
            ))}
          </AdminTable>

          <div>
            <h2 className="mb-2 text-sm font-medium">{t("admin.stockHistory")}</h2>
            <AdminTable head={[t("common.date"), "SKU", t("common.status"), t("common.quantity"), t("common.optionalNote")]}>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="px-3 py-2.5 text-[10px] text-muted">{formatDateTime(movement.created_at, locale)}</td>
                  <td className="px-3 py-2.5 font-mono text-[10px]">{movement.sku}</td>
                  <td className="px-3 py-2.5 text-[11px]">{movement.type}</td>
                  <td className={`px-3 py-2.5 ${movement.quantity < 0 ? "text-danger" : "text-success"}`}>
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-muted">{movement.note ?? "—"}</td>
                </tr>
              ))}
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted">
                    {t("common.empty")}
                  </td>
                </tr>
              ) : null}
            </AdminTable>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium">{t("admin.batches")}</h2>
            <AdminTable head={[t("admin.batches"), "SKU", t("common.quantity"), t("admin.expiry"), t("admin.freshness")]}>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td className="px-3 py-2.5 font-mono text-[10px]">{batch.batch_code}</td>
                  <td className="px-3 py-2.5 font-mono text-[10px]">{batch.product_id.slice(-6)}</td>
                  <td className="px-3 py-2.5">
                    {batch.remaining}/{batch.quantity}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-muted">{batch.expiry_at?.slice(0, 10) ?? "—"}</td>
                  <td className="px-3 py-2.5 text-[11px]">{batch.status}</td>
                </tr>
              ))}
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted">
                    {t("common.empty")}
                  </td>
                </tr>
              ) : null}
            </AdminTable>
          </div>
        </div>

        <section className="border border-line bg-white p-4">
          <h2 className="mb-3 text-sm font-medium">{t("admin.adjustStock")}</h2>
          <StockForm
            locale={locale}
            products={products.map((product) => ({
              id: product.id,
              label: `${product.name_th ?? product.sku} · ${product.sku}`,
              stock: product.stock_quantity,
            }))}
          />
          <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
            {locale === "th"
              ? "การขายจะตัดสต็อกอัตโนมัติเมื่อสร้างคำสั่งซื้อ และคืนสต็อกเมื่อยกเลิกหรือชำระเงินไม่ทันเวลา"
              : "Stock is decremented when an order is created and restored when an order is cancelled or its payment window expires."}
          </p>
        </section>
      </div>
    </div>
  );
}
