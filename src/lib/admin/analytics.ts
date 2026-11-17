import { sql } from "kysely";
import { db, nowIso } from "@/lib/db";
import { addDaysToDateString, bangkokDateString } from "@/lib/time";

export type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "month" | "lastMonth" | "custom";

export function resolvePeriod(key: PeriodKey, from?: string, to?: string): { from: string; to: string; days: number } {
  const today = bangkokDateString();
  const startOf = (date: string) => `${date}T00:00:00.000+07:00`;
  const endOf = (date: string) => `${date}T23:59:59.999+07:00`;

  switch (key) {
    case "today":
      return { from: new Date(startOf(today)).toISOString(), to: new Date(endOf(today)).toISOString(), days: 1 };
    case "yesterday": {
      const date = addDaysToDateString(today, -1);
      return { from: new Date(startOf(date)).toISOString(), to: new Date(endOf(date)).toISOString(), days: 1 };
    }
    case "7d":
      return { from: new Date(startOf(addDaysToDateString(today, -6))).toISOString(), to: new Date(endOf(today)).toISOString(), days: 7 };
    case "30d":
      return { from: new Date(startOf(addDaysToDateString(today, -29))).toISOString(), to: new Date(endOf(today)).toISOString(), days: 30 };
    case "lastMonth": {
      const firstOfThis = today.slice(0, 8) + "01";
      const lastMonthEnd = addDaysToDateString(firstOfThis, -1);
      const lastMonthStart = lastMonthEnd.slice(0, 8) + "01";
      return {
        from: new Date(startOf(lastMonthStart)).toISOString(),
        to: new Date(endOf(lastMonthEnd)).toISOString(),
        days: 30,
      };
    }
    case "custom": {
      const start = from || today;
      const end = to || today;
      const diff = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1);
      return { from: new Date(startOf(start)).toISOString(), to: new Date(endOf(end)).toISOString(), days: Math.min(366, diff) };
    }
    case "month":
    default:
      return {
        from: new Date(startOf(today.slice(0, 8) + "01")).toISOString(),
        to: new Date(endOf(today)).toISOString(),
        days: Number(today.slice(8, 10)),
      };
  }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export async function getDashboardData(from: string, to: string, days: number) {
  const base = db.selectFrom("orders").where("created_at", ">=", from).where("created_at", "<=", to);

  const [
    salesRow,
    orderCounts,
    refundRow,
    customerRows,
    lowStock,
    topProducts,
    trendRows,
    categoryRows,
    recentOrders,
    paymentMix,
  ] = await Promise.all([
    db
      .selectFrom("orders")
      .select(({ fn }) => [
        fn.sum<number>("grand_total").as("gross"),
        fn.sum<number>("discount_total").as("discount"),
        fn.countAll<string>().as("count"),
      ])
      .where("payment_status", "=", "succeeded")
      .where("created_at", ">=", from)
      .where("created_at", "<=", to)
      .executeTakeFirst(),
    base
      .select(({ fn }) => [
        fn.countAll<string>().as("total"),
        sql<string>`sum(case when status = 'pending_payment' then 1 else 0 end)`.as("pending"),
        sql<string>`sum(case when payment_status = 'succeeded' then 1 else 0 end)`.as("paid"),
        sql<string>`sum(case when status = 'delivered' then 1 else 0 end)`.as("completed"),
        sql<string>`sum(case when status = 'cancelled' then 1 else 0 end)`.as("cancelled"),
      ])
      .executeTakeFirst(),
    db
      .selectFrom("refunds")
      .select(({ fn }) => fn.sum<number>("amount").as("refunded"))
      .where("status", "=", "succeeded")
      .where("created_at", ">=", from)
      .where("created_at", "<=", to)
      .executeTakeFirst(),
    db
      .selectFrom("users")
      .select([
        sql<string>`sum(case when created_at >= ${from} then 1 else 0 end)`.as("new_customers"),
        sql<string>`sum(case when created_at < ${from} then 1 else 0 end)`.as("existing"),
      ])
      .where("role_id", "in", db.selectFrom("roles").select("id").where("slug", "=", "customer"))
      .where("deleted_at", "is", null)
      .executeTakeFirst(),
    db
      .selectFrom("products")
      .select(["id", "slug", "sku", "stock_quantity", "low_stock_threshold"])
      .where("status", "=", "published")
      .where("deleted_at", "is", null)
      .where((eb) => eb("stock_quantity", "<=", eb.ref("low_stock_threshold")))
      .orderBy("stock_quantity", "asc")
      .limit(8)
      .execute(),
    db
      .selectFrom("order_items")
      .innerJoin("orders", "orders.id", "order_items.order_id")
      .select([
        "order_items.name_th",
        "order_items.name_en",
        "order_items.sku",
        sql<number>`sum(order_items.quantity)`.as("qty"),
        sql<number>`sum(order_items.line_total)`.as("revenue"),
      ])
      .where("orders.payment_status", "=", "succeeded")
      .where("orders.created_at", ">=", from)
      .where("orders.created_at", "<=", to)
      .groupBy(["order_items.name_th", "order_items.name_en", "order_items.sku"])
      .orderBy("qty", "desc")
      .limit(6)
      .execute(),
    db
      .selectFrom("orders")
      .select([
        sql<string>`substr(created_at, 1, 10)`.as("day"),
        sql<number>`sum(grand_total)`.as("revenue"),
        sql<number>`count(*)`.as("orders"),
      ])
      .where("payment_status", "=", "succeeded")
      .where("created_at", ">=", from)
      .where("created_at", "<=", to)
      .groupBy(sql`substr(created_at, 1, 10)`)
      .orderBy(sql`substr(created_at, 1, 10)`, "asc")
      .execute(),
    db
      .selectFrom("order_items")
      .innerJoin("orders", "orders.id", "order_items.order_id")
      .leftJoin("products", "products.id", "order_items.product_id")
      .leftJoin("categories", "categories.id", "products.category_id")
      .leftJoin("category_translations as ct", (join) =>
        join.onRef("ct.category_id", "=", "categories.id").on("ct.locale", "=", "th"),
      )
      .select([
        sql<string>`coalesce(ct.name, 'Uncategorised')`.as("name"),
        sql<number>`sum(order_items.line_total)`.as("revenue"),
      ])
      .where("orders.payment_status", "=", "succeeded")
      .where("orders.created_at", ">=", from)
      .where("orders.created_at", "<=", to)
      .groupBy(sql`coalesce(ct.name, 'Uncategorised')`)
      .orderBy("revenue", "desc")
      .limit(6)
      .execute(),
    db
      .selectFrom("orders")
      .select(["id", "order_number", "status", "payment_status", "grand_total", "customer_name", "recipient_name", "created_at"])
      .orderBy("created_at", "desc")
      .limit(8)
      .execute(),
    db
      .selectFrom("payments")
      .select([
        "method",
        sql<string>`count(*)`.as("count"),
        sql<number>`sum(amount)`.as("amount"),
      ])
      .where("status", "=", "succeeded")
      .where("created_at", ">=", from)
      .where("created_at", "<=", to)
      .groupBy("method")
      .execute(),
  ]);

  const gross = Number(salesRow?.gross ?? 0);
  const paidCount = Number(salesRow?.count ?? 0);
  const refunded = Number(refundRow?.refunded ?? 0);

  const trendMap = new Map(trendRows.map((row) => [String(row.day), row]));
  const trend: Array<{ day: string; revenue: number; orders: number }> = [];
  const startDate = from.slice(0, 10);
  const totalDays = Math.min(60, days);
  for (let index = totalDays - 1; index >= 0; index -= 1) {
    const day = addDaysToDateString(bangkokDateString(), -index);
    const row = trendMap.get(day);
    trend.push({ day, revenue: Number(row?.revenue ?? 0), orders: Number(row?.orders ?? 0) });
  }
  void startDate;

  return {
    gross,
    refunded,
    netRevenue: gross - refunded,
    discountTotal: Number(salesRow?.discount ?? 0),
    paidOrders: paidCount,
    avgOrderValue: paidCount > 0 ? Math.round(gross / paidCount) : 0,
    orderCounts: {
      total: Number(orderCounts?.total ?? 0),
      pending: Number(orderCounts?.pending ?? 0),
      paid: Number(orderCounts?.paid ?? 0),
      completed: Number(orderCounts?.completed ?? 0),
      cancelled: Number(orderCounts?.cancelled ?? 0),
    },
    newCustomers: Number(customerRows?.new_customers ?? 0),
    existingCustomers: Number(customerRows?.existing ?? 0),
    lowStock,
    topProducts: topProducts.map((row) => ({
      nameTh: row.name_th,
      nameEn: row.name_en,
      sku: row.sku,
      quantity: Number(row.qty ?? 0),
      revenue: Number(row.revenue ?? 0),
    })),
    trend,
    salesByCategory: categoryRows.map((row) => ({ name: row.name, revenue: Number(row.revenue ?? 0) })),
    recentOrders,
    paymentMix: paymentMix.map((row) => ({ method: row.method, count: Number(row.count ?? 0), amount: Number(row.amount ?? 0) })),
    generatedAt: nowIso(),
  };
}

export async function getSalesReport(from: string, to: string) {
  const rows = await db
    .selectFrom("orders")
    .select([
      "order_number",
      "created_at",
      "customer_name",
      "recipient_name",
      "status",
      "payment_status",
      "subtotal",
      "addons_total",
      "discount_total",
      "shipping_total",
      "tax_total",
      "grand_total",
      "coupon_code",
    ])
    .where("created_at", ">=", from)
    .where("created_at", "<=", to)
    .orderBy("created_at", "desc")
    .execute();

  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    const current = byDay.get(day) ?? { revenue: 0, orders: 0 };
    if (row.payment_status === "succeeded") current.revenue += row.grand_total;
    current.orders += 1;
    byDay.set(day, current);
  }

  return {
    rows,
    byDay: [...byDay.entries()].map(([day, value]) => ({ day, ...value })).sort((a, b) => a.day.localeCompare(b.day)),
    totals: {
      orders: rows.length,
      revenue: rows.filter((row) => row.payment_status === "succeeded").reduce((sum, row) => sum + row.grand_total, 0),
      discounts: rows.reduce((sum, row) => sum + row.discount_total, 0),
      shipping: rows.reduce((sum, row) => sum + row.shipping_total, 0),
      tax: rows.reduce((sum, row) => sum + row.tax_total, 0),
    },
  };
}
