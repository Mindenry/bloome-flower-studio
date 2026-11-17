import { sql, type SelectQueryBuilder } from "kysely";
import { db, nowIso } from "@/lib/db";

import type { Locale } from "@/lib/i18n/config";

export type ProductSort = "newest" | "price_asc" | "price_desc" | "bestselling" | "popular";

export type ProductFilters = {
  categorySlug?: string;
  categoryIds?: string[];
  occasionSlug?: string;
  flowerType?: string;
  color?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
  featured?: boolean;
  newArrival?: boolean;
  query?: string;
  sort?: ProductSort;
  page?: number;
  perPage?: number;
  excludeIds?: string[];
  collectionSlug?: string;
};

export type ProductCard = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  shortDescription: string | null;
  price: number;
  salePrice: number | null;
  effectivePrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  imageAlt: string;
  isNew: boolean;
  isFeatured: boolean;
  flowerType: string | null;
  flowerColor: string | null;
  soldCount: number;
  createdAt: string;
  ratingAvg: number;
  reviewCount: number;
};

export type ProductImage = {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  width: number | null;
  height: number | null;
};

export type ProductVariant = {
  id: string;
  sku: string;
  name: string;
  priceDelta: number;
  stockQuantity: number;
  imageUrl: string | null;
};

export type Addon = {
  id: string;
  sku: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stockQuantity: number | null;
};

export type ProductDetail = ProductCard & {
  description: string | null;
  careInstructions: string | null;
  deliveryInformation: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  categoryId: string | null;
  occasions: Array<{ slug: string; name: string }>;
  images: ProductImage[];
  variants: ProductVariant[];
  addons: Addon[];
  flowerCount: number | null;
  bouquetSize: string | null;
  weightGrams: number;
  updatedAt: string;
  ratingBreakdown: number[];
};

const localeFallback = (locale: Locale) => [locale, locale === "th" ? "en" : "th"];

type ProductRow = {
  id: string;
  slug: string;
  sku: string;
  category_id: string | null;
  price: number;
  sale_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  new_arrival: number;
  featured: number;
  flower_type: string | null;
  flower_color: string | null;
  sold_count: number;
  created_at: string;
  name: string | null;
  short_description: string | null;
  image_url: string | null;
  alt_th: string | null;
  alt_en: string | null;
};

function toCard(row: ProductRow, locale: Locale): ProductCard {
  const salePrice = row.sale_price ?? null;
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name ?? row.slug,
    shortDescription: row.short_description,
    price: row.price,
    salePrice,
    effectivePrice: salePrice !== null && salePrice < row.price ? salePrice : row.price,
    stockQuantity: row.stock_quantity,
    lowStockThreshold: row.low_stock_threshold,
    imageUrl: row.image_url,
    imageAlt: (locale === "th" ? row.alt_th : row.alt_en) ?? row.name ?? "",
    isNew: row.new_arrival === 1,
    isFeatured: row.featured === 1,
    flowerType: row.flower_type,
    flowerColor: row.flower_color,
    soldCount: row.sold_count,
    createdAt: row.created_at,
    ratingAvg: 0,
    reviewCount: 0,
  };
}

function baseProductQuery(locale: Locale) {
  return db
    .selectFrom("products")
    .leftJoin("category_translations as ct", (join) =>
      join.onRef("ct.category_id", "=", "products.category_id").on("ct.locale", "=", locale),
    )
    .leftJoin("category_translations as ct_fallback", (join) =>
      join.onRef("ct_fallback.category_id", "=", "products.category_id").on("ct_fallback.locale", "=", "th"),
    )
    .leftJoin("product_translations as pt", (join) =>
      join.onRef("pt.product_id", "=", "products.id").on("pt.locale", "=", locale),
    )
    .leftJoin("product_translations as pt_fallback", (join) =>
      join.onRef("pt_fallback.product_id", "=", "products.id").on("pt_fallback.locale", "=", "th"),
    )
    .leftJoin("categories as c", "c.id", "products.category_id")
    .select(({ eb }) => [
      "products.id",
      "products.slug",
      "products.sku",
      "products.price",
      "products.sale_price",
      "products.stock_quantity",
      "products.low_stock_threshold",
      "products.new_arrival",
      "products.featured",
      "products.flower_type",
      "products.flower_color",
      "products.sold_count",
      "products.created_at",
      sql<string | null>`coalesce(pt.name, pt_fallback.name)`.as("name"),
      sql<string | null>`coalesce(pt.short_description, pt_fallback.short_description)`.as("short_description"),
      sql<string | null>`coalesce(ct.name, ct_fallback.name)`.as("category_name"),
      sql<string | null>`(
        select pi.url from product_images pi
        where pi.product_id = products.id
        order by pi.sort_order asc limit 1
      )`.as("image_url"),
      sql<string | null>`(
        select pi.alt_th from product_images pi
        where pi.product_id = products.id
        order by pi.sort_order asc limit 1
      )`.as("alt_th"),
      sql<string | null>`(
        select pi.alt_en from product_images pi
        where pi.product_id = products.id
        order by pi.sort_order asc limit 1
      )`.as("alt_en"),
      eb.val(0).as("unused"),
    ]);
}

// Kysely cannot express the union of the catalogue joins precisely here; the
// runtime shape is validated by the ProductCard mapping and tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProductQuery = SelectQueryBuilder<any, any, any>;

function publishedOnly<T extends ProductQuery>(query: T): T {
  return query
    .where("products.deleted_at", "is", null)
    .where("products.status", "=", "published")
    .where((eb) =>
      eb.or([eb("products.published_at", "is", null), eb("products.published_at", "<=", nowIso())]),
    ) as T;
}

function applyFilters<T extends ProductQuery>(query: T, filters: ProductFilters): T {
  let q = publishedOnly(query);

  if (filters.query) {
    const term = `%${filters.query.trim().toLowerCase()}%`;
    q = q.where((eb) =>
      eb.or([
        eb(sql`lower(coalesce(pt.name, pt_fallback.name, ''))`, "like", term),
        eb(sql`lower(coalesce(pt.short_description, pt_fallback.short_description, ''))`, "like", term),
        eb(sql`lower(coalesce(pt.description, pt_fallback.description, ''))`, "like", term),
        eb(sql`lower(products.sku)`, "like", term),
      ]),
    ) as T;
  }
  if (filters.categorySlug) {
    q = q.where("c.slug", "=", filters.categorySlug) as T;
  }
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    q = q.where("products.category_id", "in", filters.categoryIds) as T;
  }
  if (filters.occasionSlug) {
    q = q.where(
      "products.id",
      "in",
      db
        .selectFrom("product_occasions")
        .innerJoin("categories", "categories.id", "product_occasions.occasion_id")
        .select("product_occasions.product_id")
        .where("categories.slug", "=", filters.occasionSlug)
        .where("categories.kind", "=", "occasion")
        .where("categories.deleted_at", "is", null),
    ) as T;
  }
  if (filters.flowerType) q = q.where("products.flower_type", "=", filters.flowerType) as T;
  if (filters.color) q = q.where("products.flower_color", "=", filters.color) as T;
  if (filters.size) q = q.where("products.bouquet_size", "=", filters.size) as T;
  if (filters.minPrice !== undefined) {
    q = q.where(
      sql<number>`coalesce(products.sale_price, products.price)`,
      ">=",
      filters.minPrice,
    ) as T;
  }
  if (filters.maxPrice !== undefined) {
    q = q.where(sql<number>`coalesce(products.sale_price, products.price)`, "<=", filters.maxPrice) as T;
  }
  if (filters.inStock) q = q.where("products.stock_quantity", ">", 0) as T;
  if (filters.onSale) q = q.where("products.sale_price", "is not", null) as T;
  if (filters.featured) q = q.where("products.featured", "=", 1) as T;
  if (filters.newArrival) q = q.where("products.new_arrival", "=", 1) as T;
  if (filters.excludeIds && filters.excludeIds.length > 0) {
    q = q.where("products.id", "not in", filters.excludeIds) as T;
  }
  if (filters.collectionSlug) {
    q = q.where(
      "products.category_id",
      "in",
      db.selectFrom("categories").select("id").where("slug", "=", filters.collectionSlug),
    ) as T;
  }
  return q;
}

function applySort<T extends ProductQuery>(query: T, sort: ProductSort = "newest"): T {
  switch (sort) {
    case "price_asc":
      return query.orderBy(sql`coalesce(products.sale_price, products.price)`, "asc") as T;
    case "price_desc":
      return query.orderBy(sql`coalesce(products.sale_price, products.price)`, "desc") as T;
    case "bestselling":
      return query.orderBy("products.sold_count", "desc").orderBy("products.created_at", "desc") as T;
    case "popular":
      return query.orderBy("products.view_count", "desc").orderBy("products.sold_count", "desc") as T;
    default:
      return query.orderBy("products.created_at", "desc") as T;
  }
}

async function attachRatings(cards: ProductCard[]): Promise<ProductCard[]> {
  if (cards.length === 0) return cards;
  const ids = cards.map((card) => card.id);
  const rows = await db
    .selectFrom("reviews")
    .select(({ fn }) => [
      "product_id",
      fn.avg<number>("rating").as("avg"),
      fn.countAll<string>().as("count"),
    ])
    .where("product_id", "in", ids)
    .where("status", "=", "approved")
    .groupBy("product_id")
    .execute();
  const map = new Map(rows.map((r) => [r.product_id, r]));
  return cards.map((card) => {
    const stats = map.get(card.id);
    return {
      ...card,
      ratingAvg: stats ? Math.round(Number(stats.avg) * 10) / 10 : 0,
      reviewCount: stats ? Number(stats.count) : 0,
    };
  });
}

export async function listProducts(
  locale: Locale,
  filters: ProductFilters = {},
): Promise<{ items: ProductCard[]; total: number; page: number; perPage: number; totalPages: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(48, Math.max(1, filters.perPage ?? 12));

  const countQuery = applyFilters(baseProductQuery(locale), filters).select(({ fn }) =>
    fn.count<number>("products.id").as("count"),
  );
  const countRow = await countQuery.executeTakeFirst();
  const total = Number(countRow?.count ?? 0);

  const rows = await applySort(applyFilters(baseProductQuery(locale), filters), filters.sort)
    .groupBy([
      "products.id",
      "products.slug",
      "products.sku",
      "products.price",
      "products.sale_price",
      "products.stock_quantity",
      "products.low_stock_threshold",
      "products.new_arrival",
      "products.featured",
      "products.flower_type",
      "products.flower_color",
      "products.sold_count",
      "products.created_at",
      "pt.name",
      "pt.short_description",
      "pt_fallback.name",
      "pt_fallback.short_description",
      "ct.name",
      "ct_fallback.name",
    ])
    .limit(perPage)
    .offset((page - 1) * perPage)
    .execute();

  const items = await attachRatings((rows as unknown as ProductRow[]).map((row) => toCard(row, locale)));
  return { items, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getProductBySlug(locale: Locale, slug: string): Promise<ProductDetail | null> {
  const card = await publishedOnly(
    db
      .selectFrom("products")
      .leftJoin("product_translations as pt", (join) =>
        join.onRef("pt.product_id", "=", "products.id").on("pt.locale", "=", locale),
      )
      .leftJoin("product_translations as pt_fallback", (join) =>
        join.onRef("pt_fallback.product_id", "=", "products.id").on("pt_fallback.locale", "=", "th"),
      )
      .leftJoin("category_translations as ct", (join) =>
        join.onRef("ct.category_id", "=", "products.category_id").on("ct.locale", "=", locale),
      )
      .leftJoin("category_translations as ct_fallback", (join) =>
        join.onRef("ct_fallback.category_id", "=", "products.category_id").on("ct_fallback.locale", "=", "th"),
      )
      .leftJoin("categories as c", "c.id", "products.category_id")
      .selectAll("products")
      .select([
        sql<string | null>`coalesce(pt.name, pt_fallback.name)`.as("name"),
        sql<string | null>`coalesce(pt.short_description, pt_fallback.short_description)`.as("short_description"),
        sql<string | null>`coalesce(pt.description, pt_fallback.description)`.as("description"),
        sql<string | null>`coalesce(pt.care_instructions, pt_fallback.care_instructions)`.as("care_instructions"),
        sql<string | null>`coalesce(pt.delivery_information, pt_fallback.delivery_information)`.as(
          "delivery_information",
        ),
        sql<string | null>`coalesce(pt.meta_title, pt_fallback.meta_title)`.as("meta_title"),
        sql<string | null>`coalesce(pt.meta_description, pt_fallback.meta_description)`.as("meta_description"),
        sql<string | null>`coalesce(ct.name, ct_fallback.name)`.as("category_name"),
        sql<string | null>`coalesce(ct_fallback.name, ct.name)`.as("category_name_fallback"),
        sql<string | null>`c.slug`.as("category_slug"),
      ])
      .where("products.slug", "=", slug)
  )
    .executeTakeFirst();

  const product = card;
  if (!product) return null;
  const detailRow = product as unknown as ProductRow & {
    description: string | null;
    care_instructions: string | null;
    delivery_information: string | null;
    meta_title: string | null;
    meta_description: string | null;
    category_name: string | null;
    category_slug: string | null;
    bouquet_size: string | null;
    flower_count: number | null;
    weight_grams: number;
    updated_at: string;
  };

  const [images, variants, addons, ratingRows, occasions] = await Promise.all([
    db
      .selectFrom("product_images")
      .selectAll()
      .where("product_id", "=", detailRow.id)
      .orderBy("sort_order", "asc")
      .execute(),
    db
      .selectFrom("product_variants")
      .selectAll()
      .where("product_id", "=", detailRow.id)
      .where("status", "=", "active")
      .orderBy("sort_order", "asc")
      .execute(),
    db
      .selectFrom("addons")
      .selectAll()
      .where("status", "=", "active")
      .orderBy("sort_order", "asc")
      .execute(),
    db
      .selectFrom("reviews")
      .select(["rating"])
      .where("product_id", "=", detailRow.id)
      .where("status", "=", "approved")
      .execute(),
    db
      .selectFrom("product_occasions as po")
      .innerJoin("categories as c", "c.id", "po.occasion_id")
      .leftJoin("category_translations as ct", (join) =>
        join.onRef("ct.category_id", "=", "c.id").on("ct.locale", "=", locale),
      )
      .leftJoin("category_translations as ctf", (join) =>
        join.onRef("ctf.category_id", "=", "c.id").on("ctf.locale", "=", "th"),
      )
      .select([
        "c.slug",
        sql<string | null>`coalesce(ct.name, ctf.name)`.as("name"),
      ])
      .where("po.product_id", "=", detailRow.id)
      .where("c.deleted_at", "is", null)
      .orderBy("po.sort_order", "asc")
      .execute(),
  ]);

  const breakdown = [0, 0, 0, 0, 0];
  for (const review of ratingRows) {
    const index = Math.min(5, Math.max(1, review.rating)) - 1;
    breakdown[index] += 1;
  }
  const avg =
    ratingRows.length > 0
      ? Math.round((ratingRows.reduce((sum, r) => sum + r.rating, 0) / ratingRows.length) * 10) / 10
      : 0;

  const cardData = toCard({ ...detailRow, image_url: images[0]?.url ?? null }, locale);
  return {
    ...cardData,
    ratingAvg: avg,
    reviewCount: ratingRows.length,
    description: detailRow.description,
    careInstructions: detailRow.care_instructions,
    deliveryInformation: detailRow.delivery_information,
    metaTitle: detailRow.meta_title,
    metaDescription: detailRow.meta_description,
    categoryName: detailRow.category_name,
    categorySlug: detailRow.category_slug,
    categoryId: detailRow.category_id,
    occasions: occasions.map((occasion) => ({ slug: occasion.slug, name: occasion.name ?? occasion.slug })),
    flowerCount: detailRow.flower_count,
    bouquetSize: detailRow.bouquet_size,
    weightGrams: detailRow.weight_grams,
    updatedAt: detailRow.updated_at,
    ratingBreakdown: breakdown,
    images: images.map((image) => ({
      id: image.id,
      url: image.url,
      alt: (locale === "th" ? image.alt_th : image.alt_en) ?? cardData.name,
      sortOrder: image.sort_order,
      width: image.width,
      height: image.height,
    })),
    variants: variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: locale === "th" ? variant.name_th : variant.name_en,
      priceDelta: variant.price_delta,
      stockQuantity: variant.stock_quantity,
      imageUrl: variant.image_url,
    })),
    addons: addons.map((addon) => ({
      id: addon.id,
      sku: addon.sku,
      name: locale === "th" ? addon.name_th : addon.name_en,
      price: addon.price,
      imageUrl: addon.image_url,
      stockQuantity: addon.stock_quantity,
    })),
  } as ProductDetail;
}

export async function listAddons(locale: Locale): Promise<Addon[]> {
  const rows = await db
    .selectFrom("addons")
    .selectAll()
    .where("status", "=", "active")
    .orderBy("sort_order", "asc")
    .execute();
  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    name: locale === "th" ? row.name_th : row.name_en,
    price: row.price,
    imageUrl: row.image_url,
    stockQuantity: row.stock_quantity,
  }));
}

export async function getRelatedProducts(locale: Locale, productId: string, categoryId: string | null) {
  const result = await listProducts(locale, {
    categoryIds: categoryId ? [categoryId] : undefined,
    excludeIds: [productId],
    perPage: 4,
    sort: "bestselling",
  });
  if (result.items.length >= 4) return result.items;
  const fill = await listProducts(locale, { excludeIds: [productId, ...result.items.map((i) => i.id)], perPage: 4 });
  return [...result.items, ...fill.items].slice(0, 4);
}

export async function listProductsByIds(locale: Locale, ids: string[]): Promise<ProductCard[]> {
  if (ids.length === 0) return [];
  const modal = baseProductQuery(locale);
  const rows = await modal
    .where("products.id", "in", ids)
    .where("products.deleted_at", "is", null)
    .groupBy([
      "products.id",
      "products.slug",
      "products.sku",
      "products.price",
      "products.sale_price",
      "products.stock_quantity",
      "products.low_stock_threshold",
      "products.new_arrival",
      "products.featured",
      "products.flower_type",
      "products.flower_color",
      "products.sold_count",
      "products.created_at",
      "pt.name",
      "pt.short_description",
      "pt_fallback.name",
      "pt_fallback.short_description",
      "ct.name",
      "ct_fallback.name",
    ])
    .execute();
  const cards = await attachRatings((rows as unknown as ProductRow[]).map((row) => toCard(row, locale)));
  const order = new Map(ids.map((id, index) => [id, index]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function getFilterFacets(locale: Locale) {
  const [types, colors, sizes, priceRow] = await Promise.all([
    db
      .selectFrom("products")
      .select("flower_type")
      .distinct()
      .where("status", "=", "published")
      .where("flower_type", "is not", null)
      .execute(),
    db
      .selectFrom("products")
      .select("flower_color")
      .distinct()
      .where("status", "=", "published")
      .where("flower_color", "is not", null)
      .execute(),
    db
      .selectFrom("products")
      .select("bouquet_size")
      .distinct()
      .where("status", "=", "published")
      .where("bouquet_size", "is not", null)
      .execute(),
    db
      .selectFrom("products")
      .select(({ fn }) => [
        fn.min<number>("price").as("min"),
        fn.max<number>("price").as("max"),
      ])
      .where("status", "=", "published")
      .executeTakeFirst(),
  ]);
  void locale;
  return {
    flowerTypes: types.map((t) => t.flower_type).filter(Boolean) as string[],
    colors: colors.map((c) => c.flower_color).filter(Boolean) as string[],
    sizes: sizes.map((s) => s.bouquet_size).filter(Boolean) as string[],
    minPrice: Number(priceRow?.min ?? 0),
    maxPrice: Number(priceRow?.max ?? 1000000),
  };
}

export async function incrementProductView(productId: string): Promise<void> {
  await db
    .updateTable("products")
    .set((eb) => ({ view_count: eb("view_count", "+", 1) }))
    .where("id", "=", productId)
    .execute();
}

export async function getPopularSearches(): Promise<string[]> {
  const rows = await db
    .selectFrom("orders")
    .leftJoin("order_items", "order_items.order_id", "orders.id")
    .select("order_items.name_th")
    .where("orders.payment_status", "=", "succeeded")
    .where("order_items.name_th", "is not", null)
    .groupBy("order_items.name_th")
    .orderBy(({ fn }) => fn.countAll(), "desc")
    .limit(6)
    .execute();
  return rows.map((r) => r.name_th ?? "").filter(Boolean);
}

export { localeFallback };
