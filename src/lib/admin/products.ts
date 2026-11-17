import { db } from "@/lib/db";
import type { ProductFormValues } from "@/components/admin/product-form";
import type { UploadItem } from "@/components/admin/image-uploader";

export async function listCategoryOptions(locale: "th" | "en" = "th") {
  const rows = await db
    .selectFrom("categories")
    .leftJoin("category_translations as t", (join) =>
      join.onRef("t.category_id", "=", "categories.id").on("t.locale", "=", locale),
    )
    .leftJoin("category_translations as fb", (join) =>
      join.onRef("fb.category_id", "=", "categories.id").on("fb.locale", "=", "th"),
    )
    .select(["categories.id", "categories.kind", "categories.slug"])
    .select(["t.name as name", "fb.name as fallback_name"])
    .where("categories.status", "=", "active")
    .where("categories.deleted_at", "is", null)
    .orderBy("categories.kind", "asc")
    .orderBy("categories.sort_order", "asc")
    .execute();

  return rows.map((row) => ({ id: row.id, name: row.name ?? row.fallback_name ?? row.slug, kind: row.kind }));
}

export function emptyProductValues(categoryId: string): ProductFormValues {
  return {
    sku: `BLM-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    slug: "",
    categoryId,
    type: "bouquet",
    status: "draft",
    publishedAt: "",
    featured: false,
    newArrival: true,
    price: 0,
    salePrice: null,
    costPrice: null,
    stockQuantity: 0,
    lowStockThreshold: 5,
    weightGrams: 0,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    flowerType: "",
    flowerColor: "",
    bouquetSize: "",
    flowerCount: null,
    nameTh: "",
    nameEn: "",
    shortDescriptionTh: "",
    shortDescriptionEn: "",
    descriptionTh: "",
    descriptionEn: "",
    careInstructionsTh: "",
    careInstructionsEn: "",
    deliveryInformationTh: "",
    deliveryInformationEn: "",
    metaTitleTh: "",
    metaTitleEn: "",
    metaDescriptionTh: "",
    metaDescriptionEn: "",
  };
}

export async function getProductForAdmin(id: string): Promise<{
  values: ProductFormValues;
  occasionIds: string[];
  images: UploadItem[];
  variants: Array<{
    id: string;
    sku: string;
    nameTh: string;
    nameEn: string;
    priceDelta: number;
    stockQuantity: number;
    status: string;
  }>;
} | null> {
  const product = await db.selectFrom("products").selectAll().where("id", "=", id).executeTakeFirst();
  if (!product) return null;

  const [translations, images, variants, occasions] = await Promise.all([
    db.selectFrom("product_translations").selectAll().where("product_id", "=", id).execute(),
    db.selectFrom("product_images").selectAll().where("product_id", "=", id).orderBy("sort_order", "asc").execute(),
    db.selectFrom("product_variants").selectAll().where("product_id", "=", id).orderBy("sort_order", "asc").execute(),
    db.selectFrom("product_occasions").select("occasion_id").where("product_id", "=", id).orderBy("sort_order", "asc").execute(),
  ]);

  const th = translations.find((row) => row.locale === "th");
  const en = translations.find((row) => row.locale === "en");

  return {
    values: {
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      categoryId: product.category_id ?? "",
      type: product.type,
      status: product.status,
      publishedAt: product.published_at ?? "",
      featured: product.featured === 1,
      newArrival: product.new_arrival === 1,
      price: product.price,
      salePrice: product.sale_price,
      costPrice: product.cost_price,
      stockQuantity: product.stock_quantity,
      lowStockThreshold: product.low_stock_threshold,
      weightGrams: product.weight_grams,
      lengthCm: product.length_cm,
      widthCm: product.width_cm,
      heightCm: product.height_cm,
      flowerType: product.flower_type ?? "",
      flowerColor: product.flower_color ?? "",
      bouquetSize: product.bouquet_size ?? "",
      flowerCount: product.flower_count,
      nameTh: th?.name ?? "",
      nameEn: en?.name ?? "",
      shortDescriptionTh: th?.short_description ?? "",
      shortDescriptionEn: en?.short_description ?? "",
      descriptionTh: th?.description ?? "",
      descriptionEn: en?.description ?? "",
      careInstructionsTh: th?.care_instructions ?? "",
      careInstructionsEn: en?.care_instructions ?? "",
      deliveryInformationTh: th?.delivery_information ?? "",
      deliveryInformationEn: en?.delivery_information ?? "",
      metaTitleTh: th?.meta_title ?? "",
      metaTitleEn: en?.meta_title ?? "",
      metaDescriptionTh: th?.meta_description ?? "",
      metaDescriptionEn: en?.meta_description ?? "",
    },
    occasionIds: occasions.map((row) => row.occasion_id),
    images: images.map((image) => ({
      url: image.url,
      altTh: image.alt_th ?? "",
      altEn: image.alt_en ?? "",
    })),
    variants: variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      nameTh: variant.name_th,
      nameEn: variant.name_en,
      priceDelta: variant.price_delta,
      stockQuantity: variant.stock_quantity,
      status: variant.status,
    })),
  };
}
