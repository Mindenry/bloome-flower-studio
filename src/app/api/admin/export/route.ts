import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, can } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { resolvePeriod } from "@/lib/admin/analytics";
import { logActivity } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(rows: Array<Record<string, string | number | null>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number | null | undefined): string => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\r\n");
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "orders";

  const permission =
    type === "products"
      ? PERMISSIONS.PRODUCT_VIEW
      : type === "customers"
        ? PERMISSIONS.CUSTOMER_VIEW
        : PERMISSIONS.ORDER_EXPORT;

  if (!can(user, permission)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { from, to } = resolvePeriod(
    "custom",
    url.searchParams.get("from")?.slice(0, 10) ?? undefined,
    url.searchParams.get("to")?.slice(0, 10) ?? undefined,
  );

  let rows: Array<Record<string, string | number | null>> = [];
  const filename = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;

  if (type === "orders") {
    const orders = await db
      .selectFrom("orders")
      .select([
        "order_number",
        "created_at",
        "status",
        "payment_status",
        "customer_name",
        "email",
        "customer_phone",
        "recipient_name",
        "recipient_phone",
        "address_line",
        "subdistrict",
        "district",
        "province",
        "postal_code",
        "delivery_date",
        "delivery_slot_label",
        "grand_total",
        "currency",
        "coupon_code",
      ])
      .where("created_at", ">=", from)
      .where("created_at", "<=", to)
      .orderBy("created_at", "desc")
      .execute();
    // Financial exports are stored in satang; include the major-unit column for spreadsheets.
    rows = orders.map((order) => ({
      ...order,
      grand_total_thb: (order.grand_total / 100).toFixed(2),
    }));
  } else if (type === "products") {
    const products = await db
      .selectFrom("products")
      .leftJoin("product_translations as th", (join) =>
        join.onRef("th.product_id", "=", "products.id").on("th.locale", "=", "th"),
      )
      .leftJoin("product_translations as en", (join) =>
        join.onRef("en.product_id", "=", "products.id").on("en.locale", "=", "en"),
      )
      .leftJoin("categories as c", "c.id", "products.category_id")
      .select([
        "products.sku",
        "products.slug",
        "th.name as name_th",
        "en.name as name_en",
        "c.slug as category",
        "products.status",
        "products.price",
        "products.sale_price",
        "products.stock_quantity",
        "products.sold_count",
        "products.created_at",
      ])
      .where("products.deleted_at", "is", null)
      .orderBy("products.created_at", "desc")
      .execute();
    rows = products;
  } else if (type === "customers") {
    const customers = await db
      .selectFrom("users")
      .innerJoin("roles", "roles.id", "users.role_id")
      .select(["users.name", "users.email", "users.phone", "users.status", "users.locale", "users.marketing_consent", "users.created_at"])
      .where("roles.slug", "=", "customer")
      .where("users.deleted_at", "is", null)
      .orderBy("users.created_at", "desc")
      .execute();
    rows = customers;
  } else {
    return NextResponse.json({ error: "unknown_export" }, { status: 400 });
  }

  await logActivity({ actor: user, action: `export.${type}`, entityType: "export", meta: { rows: rows.length, from, to } });

  const body = `\uFEFF${csv(rows)}`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
