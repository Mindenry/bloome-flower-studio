"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, nowIso, parseJson } from "@/lib/db";
import { ids } from "@/lib/ids";
import { productSchema, stockAdjustSchema, variantSchema, type FormState } from "@/lib/schemas";
import { getCurrentUser, can } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { asLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { logActivity } from "@/lib/audit";
import { deleteStoredImage } from "@/lib/uploads";

async function guard(locale: Locale, permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS]) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!can(user, permission)) redirect(`/${locale}/admin?denied=1`);
  return user;
}

function errors(locale: Locale, issues: Array<{ path: (string | number)[]; message: string }>) {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_form";
    result[key] = translate(locale, issue.message as never);
  }
  return result;
}

function nullable(value: string | number | undefined | null): string | null {
  if (value === undefined || value === null || value === "" || value === "none") return null;
  return String(value);
}

function toSatang(value: unknown): number | undefined {
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined;
}

function numOrNull(value: unknown): number | null {
  if (value === "" || value === undefined || value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function saveProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, formData.get("id") ? PERMISSIONS.PRODUCT_UPDATE : PERMISSIONS.PRODUCT_CREATE);

  const parsed = productSchema.safeParse({
    id: formData.get("id") || undefined,
    sku: formData.get("sku"),
    slug: formData.get("slug"),
    categoryId: formData.get("categoryId"),
    type: formData.get("type"),
    status: formData.get("status"),
    publishedAt: formData.get("publishedAt") ?? "",
    featured: formData.get("featured") === "true",
    newArrival: formData.get("newArrival") === "true",
    price: toSatang(formData.get("price")),
    salePrice: formData.get("salePrice") ? toSatang(formData.get("salePrice")) : "",
    costPrice: formData.get("costPrice") ? toSatang(formData.get("costPrice")) : "",
    stockQuantity: formData.get("stockQuantity"),
    lowStockThreshold: formData.get("lowStockThreshold") || 5,
    weightGrams: formData.get("weightGrams") || 0,
    lengthCm: formData.get("lengthCm") || undefined,
    widthCm: formData.get("widthCm") || undefined,
    heightCm: formData.get("heightCm") || undefined,
    flowerType: formData.get("flowerType") ?? "",
    flowerColor: formData.get("flowerColor") ?? "",
    bouquetSize: formData.get("bouquetSize") ?? "",
    flowerCount: formData.get("flowerCount") || undefined,
    nameTh: formData.get("nameTh"),
    nameEn: formData.get("nameEn"),
    shortDescriptionTh: formData.get("shortDescriptionTh") ?? "",
    shortDescriptionEn: formData.get("shortDescriptionEn") ?? "",
    descriptionTh: formData.get("descriptionTh") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    careInstructionsTh: formData.get("careInstructionsTh") ?? "",
    careInstructionsEn: formData.get("careInstructionsEn") ?? "",
    deliveryInformationTh: formData.get("deliveryInformationTh") ?? "",
    deliveryInformationEn: formData.get("deliveryInformationEn") ?? "",
    metaTitleTh: formData.get("metaTitleTh") ?? "",
    metaTitleEn: formData.get("metaTitleEn") ?? "",
    metaDescriptionTh: formData.get("metaDescriptionTh") ?? "",
    metaDescriptionEn: formData.get("metaDescriptionEn") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors: errors(locale, parsed.error.issues) };
  }
  const data = parsed.data;
  const now = nowIso();

  const duplicateSku = await db
    .selectFrom("products")
    .select("id")
    .where("sku", "=", data.sku)
    .where("id", "!=", data.id ?? "")
    .executeTakeFirst();
  if (duplicateSku) return { ok: false, error: translate(locale, "validation.skuUnique"), fieldErrors: { sku: translate(locale, "validation.skuUnique") } };

  const duplicateSlug = await db
    .selectFrom("products")
    .select("id")
    .where("slug", "=", data.slug)
    .where("id", "!=", data.id ?? "")
    .executeTakeFirst();
  if (duplicateSlug) return { ok: false, error: translate(locale, "validation.slugUnique"), fieldErrors: { slug: translate(locale, "validation.slugUnique") } };

  const productId = data.id ?? ids.product();
  const existing = data.id
    ? await db.selectFrom("products").selectAll().where("id", "=", data.id).executeTakeFirst()
    : null;
  if (data.id && !existing) return { ok: false, error: translate(locale, "common.notFound") };

  const publishedAt =
    data.status === "published"
      ? existing?.published_at ?? now
      : data.publishedAt
        ? new Date(data.publishedAt).toISOString()
        : null;

  const stockValue = data.stockQuantity;
  const stockDelta = existing ? stockValue - existing.stock_quantity : stockValue;

  await db.transaction().execute(async (tx) => {
    if (existing) {
      await tx
        .updateTable("products")
        .set({
          sku: data.sku,
          slug: data.slug,
          category_id: data.categoryId,
          type: data.type,
          status: data.status,
          published_at: publishedAt,
          featured: data.featured ? 1 : 0,
          new_arrival: data.newArrival ? 1 : 0,
          price: data.price,
          sale_price: typeof data.salePrice === "number" ? data.salePrice : null,
          cost_price: typeof data.costPrice === "number" ? data.costPrice : null,
          stock_quantity: stockValue,
          low_stock_threshold: data.lowStockThreshold,
          weight_grams: data.weightGrams,
          length_cm: numOrNull(data.lengthCm),
          width_cm: numOrNull(data.widthCm),
          height_cm: numOrNull(data.heightCm),
          flower_type: nullable(data.flowerType),
          flower_color: nullable(data.flowerColor),
          bouquet_size: nullable(data.bouquetSize),
          flower_count: numOrNull(data.flowerCount),
          archived_at: data.status === "archived" ? now : null,
          updated_at: now,
        })
        .where("id", "=", productId)
        .execute();
    } else {
      await tx
        .insertInto("products")
        .values({
          id: productId,
          sku: data.sku,
          slug: data.slug,
          category_id: data.categoryId,
          type: data.type,
          status: data.status,
          published_at: publishedAt,
          featured: data.featured ? 1 : 0,
          new_arrival: data.newArrival ? 1 : 0,
          price: data.price,
          sale_price: typeof data.salePrice === "number" ? data.salePrice : null,
          cost_price: typeof data.costPrice === "number" ? data.costPrice : null,
          stock_quantity: stockValue,
          low_stock_threshold: data.lowStockThreshold,
          weight_grams: data.weightGrams,
          length_cm: numOrNull(data.lengthCm),
          width_cm: numOrNull(data.widthCm),
          height_cm: numOrNull(data.heightCm),
          flower_type: nullable(data.flowerType),
          flower_color: nullable(data.flowerColor),
          bouquet_size: nullable(data.bouquetSize),
          flower_count: numOrNull(data.flowerCount),
          sold_count: 0,
          view_count: 0,
          created_by: user.id,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          archived_at: null,
        })
        .execute();
    }

    for (const localeKey of ["th", "en"] as const) {
      const translation = {
        name: localeKey === "th" ? data.nameTh : data.nameEn,
        short_description: localeKey === "th" ? data.shortDescriptionTh || null : data.shortDescriptionEn || null,
        description: localeKey === "th" ? data.descriptionTh || null : data.descriptionEn || null,
        care_instructions: localeKey === "th" ? data.careInstructionsTh || null : data.careInstructionsEn || null,
        delivery_information:
          localeKey === "th" ? data.deliveryInformationTh || null : data.deliveryInformationEn || null,
        meta_title: localeKey === "th" ? data.metaTitleTh || null : data.metaTitleEn || null,
        meta_description: localeKey === "th" ? data.metaDescriptionTh || null : data.metaDescriptionEn || null,
      };
      const existingTranslation = await tx
        .selectFrom("product_translations")
        .select("id")
        .where("product_id", "=", productId)
        .where("locale", "=", localeKey)
        .executeTakeFirst();
      if (existingTranslation) {
        await tx
          .updateTable("product_translations")
          .set({ ...translation, updated_at: now })
          .where("id", "=", existingTranslation.id)
          .execute();
      } else {
        await tx
          .insertInto("product_translations")
          .values({
            id: ids.product(),
            product_id: productId,
            locale: localeKey,
            ...translation,
            created_at: now,
            updated_at: now,
          })
          .execute();
      }
    }

    if (stockDelta !== 0) {
      await tx
        .insertInto("inventory_movements")
        .values({
          id: ids.inventoryMovement(),
          product_id: productId,
          variant_id: null,
          type: stockDelta > 0 ? "in" : "adjust",
          quantity: stockDelta,
          reference_type: "product_edit",
          reference_id: productId,
          note: "Stock set from product form",
          created_by: user.id,
          created_at: now,
        })
        .execute();
    }

    const occasionIds = formData.getAll("occasionIds").map(String).filter(Boolean);
    await tx.deleteFrom("product_occasions").where("product_id", "=", productId).execute();
    for (let index = 0; index < occasionIds.length; index += 1) {
      await tx
        .insertInto("product_occasions")
        .values({ product_id: productId, occasion_id: occasionIds[index], sort_order: index })
        .execute();
    }

    const images = parseJson<Array<{ url: string; altTh?: string; altEn?: string }>>(
      String(formData.get("images") ?? "[]"),
      [],
    );
    await tx.deleteFrom("product_images").where("product_id", "=", productId).execute();
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      if (!image?.url) continue;
      await tx
        .insertInto("product_images")
        .values({
          id: ids.productImage(),
          product_id: productId,
          url: image.url,
          alt_th: image.altTh || null,
          alt_en: image.altEn || null,
          sort_order: index,
          width: null,
          height: null,
          created_at: now,
        })
        .execute();
    }
  });

  await logActivity({
    actor: user,
    action: existing ? "product.update" : "product.create",
    entityType: "product",
    entityId: productId,
    meta: { sku: data.sku, status: data.status },
  });

  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/shop`);
  revalidatePath(`/${locale}/product/${data.slug}`);
  revalidatePath("/", "layout");

  if (!existing) redirect(`/${locale}/admin/products/${productId}?created=1`);
  return { ok: true, message: translate(locale, "common.saved"), data: { id: productId } };
}

export async function archiveProductAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.PRODUCT_DELETE);
  const productId = String(formData.get("productId") ?? "");
  const now = nowIso();
  await db
    .updateTable("products")
    .set({ status: "archived", archived_at: now, updated_at: now })
    .where("id", "=", productId)
    .execute();
  await logActivity({ actor: user, action: "product.archive", entityType: "product", entityId: productId });
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath("/", "layout");
}

export async function restoreProductAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.PRODUCT_UPDATE);
  const productId = String(formData.get("productId") ?? "");
  await db
    .updateTable("products")
    .set({ status: "draft", archived_at: null, updated_at: nowIso() })
    .where("id", "=", productId)
    .execute();
  await logActivity({ actor: user, action: "product.restore", entityType: "product", entityId: productId });
  revalidatePath(`/${locale}/admin/products`);
}

export async function togglePublishAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.PRODUCT_UPDATE);
  const productId = String(formData.get("productId") ?? "");
  const product = await db.selectFrom("products").select(["status", "published_at"]).where("id", "=", productId).executeTakeFirst();
  if (!product) return;
  const publish = product.status !== "published";
  await db
    .updateTable("products")
    .set({
      status: publish ? "published" : "draft",
      published_at: publish ? product.published_at ?? nowIso() : product.published_at,
      updated_at: nowIso(),
    })
    .where("id", "=", productId)
    .execute();
  await logActivity({
    actor: user,
    action: publish ? "product.publish" : "product.unpublish",
    entityType: "product",
    entityId: productId,
  });
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath("/", "layout");
}

export async function duplicateProductAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.PRODUCT_CREATE);
  const productId = String(formData.get("productId") ?? "");
  const product = await db.selectFrom("products").selectAll().where("id", "=", productId).executeTakeFirst();
  if (!product) return;
  const newId = ids.product();
  const suffix = Date.now().toString(36);
  const now = nowIso();
  const translations = await db.selectFrom("product_translations").selectAll().where("product_id", "=", productId).execute();
  const images = await db.selectFrom("product_images").selectAll().where("product_id", "=", productId).execute();

  await db.transaction().execute(async (tx) => {
    await tx
      .insertInto("products")
      .values({
        ...product,
        id: newId,
        sku: `${product.sku}-COPY${suffix.slice(-4).toUpperCase()}`,
        slug: `${product.slug}-copy-${suffix}`,
        status: "draft",
        published_at: null,
        sold_count: 0,
        view_count: 0,
        created_by: user.id,
        created_at: now,
        updated_at: now,
        archived_at: null,
      })
      .execute();
    for (const translation of translations) {
      await tx
        .insertInto("product_translations")
        .values({ ...translation, id: ids.product(), product_id: newId, created_at: now, updated_at: now })
        .execute();
    }
    for (const image of images) {
      await tx
        .insertInto("product_images")
        .values({ ...image, id: ids.productImage(), product_id: newId, created_at: now })
        .execute();
    }
  });
  await logActivity({ actor: user, action: "product.duplicate", entityType: "product", entityId: productId });
  revalidatePath(`/${locale}/admin/products`);
  redirect(`/${locale}/admin/products/${newId}?duplicated=1`);
}

export async function hardDeleteProductAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.PRODUCT_DELETE);
  const productId = String(formData.get("productId") ?? "");
  const used = await db.selectFrom("order_items").select("id").where("product_id", "=", productId).limit(1).executeTakeFirst();
  if (used) {
    await db.updateTable("products").set({ status: "archived", archived_at: nowIso(), updated_at: nowIso() }).where("id", "=", productId).execute();
  } else {
    const images = await db.selectFrom("product_images").select("url").where("product_id", "=", productId).execute();
    await db.deleteFrom("products").where("id", "=", productId).execute();
    for (const image of images) await deleteStoredImage(image.url).catch(() => undefined);
  }
  await logActivity({ actor: user, action: "product.delete", entityType: "product", entityId: productId });
  revalidatePath(`/${locale}/admin/products`);
  redirect(`/${locale}/admin/products`);
}

export async function saveVariantAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.PRODUCT_UPDATE);
  const parsed = variantSchema.safeParse({
    id: formData.get("id") || undefined,
    productId: formData.get("productId"),
    sku: formData.get("sku"),
    nameTh: formData.get("nameTh"),
    nameEn: formData.get("nameEn"),
    priceDelta: toSatang(formData.get("priceDelta")) ?? 0,
    stockQuantity: formData.get("stockQuantity") || 0,
    status: formData.get("status") || "active",
  });
  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors: errors(locale, parsed.error.issues) };
  }
  const now = nowIso();
  if (parsed.data.id) {
    await db
      .updateTable("product_variants")
      .set({
        sku: parsed.data.sku,
        name_th: parsed.data.nameTh,
        name_en: parsed.data.nameEn,
        price_delta: parsed.data.priceDelta,
        stock_quantity: parsed.data.stockQuantity,
        status: parsed.data.status,
        updated_at: now,
      })
      .where("id", "=", parsed.data.id)
      .where("product_id", "=", parsed.data.productId)
      .execute();
  } else {
    await db
      .insertInto("product_variants")
      .values({
        id: ids.variant(),
        product_id: parsed.data.productId,
        sku: parsed.data.sku,
        name_th: parsed.data.nameTh,
        name_en: parsed.data.nameEn,
        price_delta: parsed.data.priceDelta,
        stock_quantity: parsed.data.stockQuantity,
        image_url: null,
        status: parsed.data.status,
        sort_order: Date.now() % 100000,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }
  await logActivity({ actor: user, action: "product.variant_save", entityType: "product", entityId: parsed.data.productId });
  revalidatePath(`/${locale}/admin/products/${parsed.data.productId}`);
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function updateVariantAction(formData: FormData): Promise<void> {
  await saveVariantAction({ ok: false }, formData);
}

export async function deleteVariantAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.PRODUCT_UPDATE);
  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("productId") ?? "");
  await db.deleteFrom("product_variants").where("id", "=", id).where("product_id", "=", productId).execute();
  await logActivity({ actor: user, action: "product.variant_delete", entityType: "product", entityId: productId });
  revalidatePath(`/${locale}/admin/products/${productId}`);
}

export async function adjustStockAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.INVENTORY_MANAGE);
  const parsed = stockAdjustSchema.safeParse({
    productId: formData.get("productId"),
    variantId: formData.get("variantId") ?? "",
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    note: formData.get("note") ?? "",
    batchCode: formData.get("batchCode") ?? "",
    expiryAt: formData.get("expiryAt") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors: errors(locale, parsed.error.issues) };
  }
  const data = parsed.data;
  const delta = data.type === "out" || data.type === "waste" ? -data.quantity : data.type === "in" ? data.quantity : data.quantity;
  const now = nowIso();

  await db.transaction().execute(async (tx) => {
    if (data.variantId) {
      await tx
        .updateTable("product_variants")
        .set((eb) => ({ stock_quantity: eb("stock_quantity", "+", delta), updated_at: now }))
        .where("id", "=", data.variantId)
        .execute();
    }
    await tx
      .updateTable("products")
      .set((eb) => ({ stock_quantity: eb("stock_quantity", "+", delta), updated_at: now }))
      .where("id", "=", data.productId)
      .execute();
    await tx
      .insertInto("inventory_movements")
      .values({
        id: ids.inventoryMovement(),
        product_id: data.productId,
        variant_id: data.variantId || null,
        type: data.type,
        quantity: delta,
        reference_type: "manual",
        reference_id: null,
        note: data.note || null,
        created_by: user.id,
        created_at: now,
      })
      .execute();
    if (data.batchCode) {
      await tx
        .insertInto("inventory_batches")
        .values({
          id: ids.inventoryBatch(),
          product_id: data.productId,
          batch_code: data.batchCode,
          received_at: now,
          expiry_at: data.expiryAt ? new Date(data.expiryAt).toISOString() : null,
          quantity: data.quantity,
          remaining: data.quantity,
          status: "fresh",
          note: data.note || null,
          created_at: now,
        })
        .execute();
    }
  });

  await logActivity({ actor: user, action: "inventory.adjust", entityType: "product", entityId: data.productId, meta: { type: data.type, quantity: delta } });
  revalidatePath(`/${locale}/admin/inventory`);
  revalidatePath(`/${locale}/admin/products/${data.productId}`);
  return { ok: true, message: translate(locale, "admin.stockAdjusted") };
}

export async function bulkProductAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale, PERMISSIONS.PRODUCT_UPDATE);
  const action = String(formData.get("bulkAction") ?? "");
  const idsList = formData.getAll("productIds").map(String).filter(Boolean);
  if (idsList.length === 0) return;
  const now = nowIso();
  if (action === "publish") {
    await db.updateTable("products").set({ status: "published", published_at: now, updated_at: now }).where("id", "in", idsList).execute();
  } else if (action === "unpublish") {
    await db.updateTable("products").set({ status: "draft", updated_at: now }).where("id", "in", idsList).execute();
  } else if (action === "archive") {
    await db.updateTable("products").set({ status: "archived", archived_at: now, updated_at: now }).where("id", "in", idsList).execute();
  }
  await logActivity({ actor: user, action: `product.bulk_${action}`, entityType: "product", meta: { count: idsList.length } });
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath("/", "layout");
}
