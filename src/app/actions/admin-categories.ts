"use server";

import { revalidatePath } from "next/cache";
import { db, nowIso } from "@/lib/db";
import { ids } from "@/lib/ids";
import { categorySchema, type FormState } from "@/lib/schemas";
import { getCurrentUser, can } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { asLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { logActivity } from "@/lib/audit";
import { redirect } from "next/navigation";

async function guard(locale: Locale) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!can(user, PERMISSIONS.CATEGORY_MANAGE)) redirect(`/${locale}/admin?denied=1`);
  return user;
}

export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale);
  const parsed = categorySchema.safeParse({
    id: formData.get("id") || undefined,
    slug: formData.get("slug"),
    kind: formData.get("kind") || "category",
    nameTh: formData.get("nameTh"),
    nameEn: formData.get("nameEn"),
    descriptionTh: formData.get("descriptionTh") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    imageUrl: formData.get("imageUrl") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
    status: formData.get("status") || "active",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "_form"] = translate(locale, issue.message as never);
    }
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors };
  }
  const data = parsed.data;
  const now = nowIso();

  const duplicate = await db
    .selectFrom("categories")
    .select("id")
    .where("slug", "=", data.slug)
    .where("id", "!=", data.id ?? "")
    .executeTakeFirst();
  if (duplicate) {
    return { ok: false, error: translate(locale, "validation.slugUnique"), fieldErrors: { slug: translate(locale, "validation.slugUnique") } };
  }

  const categoryId = data.id ?? ids.category();
  await db.transaction().execute(async (tx) => {
    if (data.id) {
      await tx
        .updateTable("categories")
        .set({
          slug: data.slug,
          kind: data.kind,
          image_url: data.imageUrl || null,
          sort_order: data.sortOrder,
          status: data.status,
          updated_at: now,
        })
        .where("id", "=", categoryId)
        .execute();
    } else {
      await tx
        .insertInto("categories")
        .values({
          id: categoryId,
          slug: data.slug,
          parent_id: null,
          image_url: data.imageUrl || null,
          sort_order: data.sortOrder,
          status: data.status,
          kind: data.kind,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        })
        .execute();
    }

    for (const localeKey of ["th", "en"] as const) {
      const values = {
        name: localeKey === "th" ? data.nameTh : data.nameEn,
        description: localeKey === "th" ? data.descriptionTh || null : data.descriptionEn || null,
        meta_title: localeKey === "th" ? data.nameTh : data.nameEn,
        meta_description: localeKey === "th" ? data.descriptionTh || null : data.descriptionEn || null,
      };
      const existing = await tx
        .selectFrom("category_translations")
        .select("id")
        .where("category_id", "=", categoryId)
        .where("locale", "=", localeKey)
        .executeTakeFirst();
      if (existing) {
        await tx
          .updateTable("category_translations")
          .set({ ...values, updated_at: now })
          .where("id", "=", existing.id)
          .execute();
      } else {
        await tx
          .insertInto("category_translations")
          .values({
            id: ids.category(),
            category_id: categoryId,
            locale: localeKey,
            ...values,
            created_at: now,
            updated_at: now,
          })
          .execute();
      }
    }
  });

  await logActivity({ actor: user, action: data.id ? "category.update" : "category.create", entityType: "category", entityId: categoryId });
  revalidatePath(`/${locale}/admin/categories`);
  revalidatePath("/", "layout");
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale);
  const id = String(formData.get("id") ?? "");
  const used = await db.selectFrom("products").select("id").where("category_id", "=", id).limit(1).executeTakeFirst();
  if (used) {
    await db.updateTable("categories").set({ status: "hidden", updated_at: nowIso() }).where("id", "=", id).execute();
  } else {
    await db.updateTable("categories").set({ deleted_at: nowIso(), status: "hidden" }).where("id", "=", id).execute();
  }
  await logActivity({ actor: user, action: "category.delete", entityType: "category", entityId: id });
  revalidatePath(`/${locale}/admin/categories`);
  revalidatePath("/", "layout");
}
