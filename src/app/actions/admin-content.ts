"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, nowIso } from "@/lib/db";
import { ids } from "@/lib/ids";
import { bannerSchema, faqSchema, pageSchema, type FormState } from "@/lib/schemas";
import { getCurrentUser, can } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { asLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { logActivity } from "@/lib/audit";

async function guard(locale: Locale) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!can(user, PERMISSIONS.CONTENT_MANAGE)) redirect(`/${locale}/admin?denied=1`);
  return user;
}

async function guardBlog(locale: Locale) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!can(user, PERMISSIONS.BLOG_MANAGE)) redirect(`/${locale}/admin?denied=1`);
  return user;
}

function invalid(locale: Locale): FormState {
  return { ok: false, error: translate(locale, "error.validation") };
}

export async function saveBannerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale);
  const parsed = bannerSchema.safeParse({
    id: formData.get("id") || undefined,
    placement: formData.get("placement"),
    titleTh: formData.get("titleTh"),
    titleEn: formData.get("titleEn"),
    subtitleTh: formData.get("subtitleTh") ?? "",
    subtitleEn: formData.get("subtitleEn") ?? "",
    imageUrl: formData.get("imageUrl") ?? "",
    linkUrl: formData.get("linkUrl") ?? "",
    ctaTh: formData.get("ctaTh") ?? "",
    ctaEn: formData.get("ctaEn") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
    status: formData.get("status") || "active",
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") ?? "",
  });
  if (!parsed.success) return invalid(locale);
  const data = parsed.data;
  const now = nowIso();
  const values = {
    placement: data.placement,
    title_th: data.titleTh,
    title_en: data.titleEn,
    subtitle_th: data.subtitleTh || null,
    subtitle_en: data.subtitleEn || null,
    image_url: data.imageUrl || null,
    link_url: data.linkUrl || null,
    cta_th: data.ctaTh || null,
    cta_en: data.ctaEn || null,
    sort_order: data.sortOrder,
    status: data.status,
    starts_at: data.startsAt ? new Date(data.startsAt).toISOString() : null,
    ends_at: data.endsAt ? new Date(data.endsAt).toISOString() : null,
    updated_at: now,
  };
  if (data.id) {
    await db.updateTable("banners").set(values).where("id", "=", data.id).execute();
  } else {
    await db.insertInto("banners").values({ id: ids.banner(), ...values, created_at: now }).execute();
  }
  await logActivity({ actor: user, action: "content.banner_save", entityType: "banner", entityId: data.id ?? null });
  revalidatePath(`/${locale}/admin/content`);
  revalidatePath("/", "layout");
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function deleteBannerAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guard(locale);
  await db.deleteFrom("banners").where("id", "=", String(formData.get("id") ?? "")).execute();
  revalidatePath(`/${locale}/admin/content`);
  revalidatePath("/", "layout");
}

export async function savePageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale);
  const parsed = pageSchema.safeParse({
    id: formData.get("id") || undefined,
    slug: formData.get("slug"),
    template: formData.get("template") || "page",
    status: formData.get("status") || "published",
    titleTh: formData.get("titleTh"),
    titleEn: formData.get("titleEn"),
    bodyTh: formData.get("bodyTh"),
    bodyEn: formData.get("bodyEn"),
    metaTitleTh: formData.get("metaTitleTh") ?? "",
    metaTitleEn: formData.get("metaTitleEn") ?? "",
    metaDescriptionTh: formData.get("metaDescriptionTh") ?? "",
    metaDescriptionEn: formData.get("metaDescriptionEn") ?? "",
  });
  if (!parsed.success) return invalid(locale);
  const data = parsed.data;
  const now = nowIso();
  const pageId = data.id ?? ids.page();

  await db.transaction().execute(async (tx) => {
    if (data.id) {
      await tx
        .updateTable("content_pages")
        .set({ slug: data.slug, template: data.template, status: data.status, updated_at: now })
        .where("id", "=", pageId)
        .execute();
    } else {
      await tx
        .insertInto("content_pages")
        .values({ id: pageId, slug: data.slug, template: data.template, status: data.status, created_at: now, updated_at: now })
        .execute();
    }
    for (const localeKey of ["th", "en"] as const) {
      const values = {
        title: localeKey === "th" ? data.titleTh : data.titleEn,
        body: localeKey === "th" ? data.bodyTh : data.bodyEn,
        meta_title: localeKey === "th" ? data.metaTitleTh || null : data.metaTitleEn || null,
        meta_description: localeKey === "th" ? data.metaDescriptionTh || null : data.metaDescriptionEn || null,
      };
      const existing = await tx
        .selectFrom("content_page_translations")
        .select("id")
        .where("page_id", "=", pageId)
        .where("locale", "=", localeKey)
        .executeTakeFirst();
      if (existing) {
        await tx.updateTable("content_page_translations").set(values).where("id", "=", existing.id).execute();
      } else {
        await tx
          .insertInto("content_page_translations")
          .values({ id: ids.page(), page_id: pageId, locale: localeKey, ...values })
          .execute();
      }
    }
  });

  await logActivity({ actor: user, action: "content.page_save", entityType: "page", entityId: pageId });
  revalidatePath(`/${locale}/admin/content`);
  revalidatePath("/", "layout");
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function deletePageAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guard(locale);
  await db.deleteFrom("content_pages").where("id", "=", String(formData.get("id") ?? "")).execute();
  revalidatePath(`/${locale}/admin/content`);
}

export async function saveFaqAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale);
  const parsed = faqSchema.safeParse({
    id: formData.get("id") || undefined,
    category: formData.get("category") ?? "",
    questionTh: formData.get("questionTh"),
    questionEn: formData.get("questionEn"),
    answerTh: formData.get("answerTh"),
    answerEn: formData.get("answerEn"),
    sortOrder: formData.get("sortOrder") ?? 0,
    status: formData.get("status") || "active",
  });
  if (!parsed.success) return invalid(locale);
  const data = parsed.data;
  const now = nowIso();
  const values = {
    category: data.category || null,
    question_th: data.questionTh,
    question_en: data.questionEn,
    answer_th: data.answerTh,
    answer_en: data.answerEn,
    sort_order: data.sortOrder,
    status: data.status,
    updated_at: now,
  };
  if (data.id) {
    await db.updateTable("faqs").set(values).where("id", "=", data.id).execute();
  } else {
    await db.insertInto("faqs").values({ id: ids.faq(), ...values, created_at: now }).execute();
  }
  await logActivity({ actor: user, action: "content.faq_save", entityType: "faq", entityId: data.id ?? null });
  revalidatePath(`/${locale}/admin/content`);
  revalidatePath("/", "layout");
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function deleteFaqAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guard(locale);
  await db.deleteFrom("faqs").where("id", "=", String(formData.get("id") ?? "")).execute();
  revalidatePath(`/${locale}/admin/content`);
}

export async function saveGalleryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guard(locale);
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const linkUrl = String(formData.get("linkUrl") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  if (!imageUrl) return invalid(locale);
  await db
    .insertInto("site_gallery")
    .values({
      id: ids.gallery(),
      image_url: imageUrl.slice(0, 500),
      link_url: linkUrl.slice(0, 500) || null,
      caption: caption.slice(0, 200) || null,
      sort_order: Number(formData.get("sortOrder") ?? 0) || 0,
      status: "active",
      created_at: nowIso(),
    })
    .execute();
  revalidatePath(`/${locale}/admin/content`);
  revalidatePath("/", "layout");
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function deleteGalleryAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guard(locale);
  await db.deleteFrom("site_gallery").where("id", "=", String(formData.get("id") ?? "")).execute();
  revalidatePath(`/${locale}/admin/content`);
  revalidatePath("/", "layout");
}

export async function saveBlogPostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guardBlog(locale);
  const slug = String(formData.get("slug") ?? "").trim();
  const titleTh = String(formData.get("titleTh") ?? "").trim();
  const titleEn = String(formData.get("titleEn") ?? "").trim();
  const contentTh = String(formData.get("contentTh") ?? "").trim();
  const contentEn = String(formData.get("contentEn") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  const id = String(formData.get("id") ?? "");

  if (!slug || !titleTh || !titleEn || contentTh.length < 20 || contentEn.length < 20) {
    return invalid(locale);
  }

  const duplicate = await db
    .selectFrom("blog_posts")
    .select("id")
    .where("slug", "=", slug)
    .where("id", "!=", id)
    .executeTakeFirst();
  if (duplicate) return { ok: false, error: translate(locale, "validation.slugUnique") };

  const now = nowIso();
  const postId = id || ids.blogPost();
  await db.transaction().execute(async (tx) => {
    const values = {
      slug,
      cover_image: String(formData.get("coverImage") ?? "").trim() || null,
      category: String(formData.get("category") ?? "").trim() || null,
      status,
      published_at: status === "published" ? now : null,
      updated_at: now,
    };
    if (id) {
      await tx.updateTable("blog_posts").set(values).where("id", "=", postId).execute();
    } else {
      await tx
        .insertInto("blog_posts")
        .values({ id: postId, author_id: user.id, ...values, created_at: now })
        .execute();
    }
    for (const localeKey of ["th", "en"] as const) {
      const translation = {
        title: localeKey === "th" ? titleTh : titleEn,
        excerpt: String(formData.get(localeKey === "th" ? "excerptTh" : "excerptEn") ?? "").trim() || null,
        content: localeKey === "th" ? contentTh : contentEn,
        meta_title: String(formData.get(localeKey === "th" ? "metaTitleTh" : "metaTitleEn") ?? "").trim() || null,
        meta_description:
          String(formData.get(localeKey === "th" ? "metaDescriptionTh" : "metaDescriptionEn") ?? "").trim() || null,
      };
      const existing = await tx
        .selectFrom("blog_post_translations")
        .select("id")
        .where("post_id", "=", postId)
        .where("locale", "=", localeKey)
        .executeTakeFirst();
      if (existing) {
        await tx.updateTable("blog_post_translations").set(translation).where("id", "=", existing.id).execute();
      } else {
        await tx
          .insertInto("blog_post_translations")
          .values({ id: ids.blogPost(), post_id: postId, locale: localeKey, ...translation })
          .execute();
      }
    }
  });

  await logActivity({ actor: user, action: "blog.save", entityType: "blog", entityId: postId });
  revalidatePath(`/${locale}/admin/blog`);
  revalidatePath(`/${locale}/blog`);
  return { ok: true, message: translate(locale, "common.saved") };
}

export async function deleteBlogPostAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guardBlog(locale);
  await db.deleteFrom("blog_posts").where("id", "=", String(formData.get("id") ?? "")).execute();
  revalidatePath(`/${locale}/admin/blog`);
  revalidatePath(`/${locale}/blog`);
}
