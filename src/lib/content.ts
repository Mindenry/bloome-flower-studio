import { sql } from "kysely";
import { db, nowIso } from "@/lib/db";
import type { Locale } from "@/lib/i18n/config";

export type NavItem = { slug: string; name: string; imageUrl: string | null };

export async function getCategoryBySlug(slug: string, locale: Locale) {
  const row = await db
    .selectFrom("categories as c")
    .leftJoin("category_translations as t", (join) =>
      join.onRef("t.category_id", "=", "c.id").on("t.locale", "=", locale),
    )
    .leftJoin("category_translations as fallback", (join) =>
      join.onRef("fallback.category_id", "=", "c.id").on("fallback.locale", "=", "th"),
    )
    .select([
      "c.id",
      "c.slug",
      "c.kind",
      "c.image_url",
      sql<string | null>`coalesce(t.name, fallback.name)`.as("name"),
      sql<string | null>`coalesce(t.description, fallback.description)`.as("description"),
      sql<string | null>`coalesce(t.meta_title, fallback.meta_title)`.as("meta_title"),
      sql<string | null>`coalesce(t.meta_description, fallback.meta_description)`.as("meta_description"),
    ])
    .where("c.slug", "=", slug)
    .where("c.status", "=", "active")
    .where("c.deleted_at", "is", null)
    .executeTakeFirst();

  if (!row?.name) return null;
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    imageUrl: row.image_url,
    name: row.name,
    description: row.description,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
  };
}

export async function getNavData(
  locale: Locale,
): Promise<{ categories: NavItem[]; collections: NavItem[]; occasions: NavItem[] }> {
  const rows = await db
    .selectFrom("categories as c")
    .leftJoin("category_translations as ct", (join) =>
      join.onRef("ct.category_id", "=", "c.id").on("ct.locale", "=", locale),
    )
    .leftJoin("category_translations as fallback", (join) =>
      join.onRef("fallback.category_id", "=", "c.id").on("fallback.locale", "=", "th"),
    )
    .select([
      "c.slug",
      "c.kind",
      "c.image_url",
      sql<string | null>`coalesce(ct.name, fallback.name)`.as("name"),
    ])
    .where("c.status", "=", "active")
    .where("c.deleted_at", "is", null)
    .orderBy("c.kind", "asc")
    .orderBy("c.sort_order", "asc")
    .execute();

  const map = (kind: string): NavItem[] =>
    rows
      .filter((row) => row.kind === kind)
      .map((row) => ({ slug: row.slug, name: row.name ?? row.slug, imageUrl: row.image_url }));

  return {
    categories: map("category"),
    collections: map("collection"),
    occasions: map("occasion"),
  };
}

export type BannerView = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  cta: string | null;
};

export async function getActiveBanners(
  placement: "home_hero" | "announcement" | "home_special" | "social",
  locale: Locale,
): Promise<BannerView[]> {
  const now = nowIso();
  const rows = await db
    .selectFrom("banners")
    .selectAll()
    .where("placement", "=", placement)
    .where("status", "=", "active")
    .where((eb) => eb.or([eb("starts_at", "is", null), eb("starts_at", "<=", now)]))
    .where((eb) => eb.or([eb("ends_at", "is", null), eb("ends_at", ">=", now)]))
    .orderBy("sort_order", "asc")
    .execute();

  return rows.map((row) => ({
    id: row.id,
    title: locale === "th" ? row.title_th : row.title_en,
    subtitle: locale === "th" ? row.subtitle_th : row.subtitle_en,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    cta: locale === "th" ? row.cta_th : row.cta_en,
  }));
}

export async function getContentPage(slug: string, locale: Locale) {
  const page = await db
    .selectFrom("content_pages")
    .leftJoin("content_page_translations as t", (join) =>
      join.onRef("t.page_id", "=", "content_pages.id").on("t.locale", "=", locale),
    )
    .leftJoin("content_page_translations as fallback", (join) =>
      join.onRef("fallback.page_id", "=", "content_pages.id").on("fallback.locale", "=", "th"),
    )
    .select([
      "content_pages.id",
      "content_pages.slug",
      "content_pages.template",
      "content_pages.status",
      sql<string | null>`coalesce(t.title, fallback.title)`.as("title"),
      sql<string | null>`coalesce(t.body, fallback.body)`.as("body"),
      sql<string | null>`coalesce(t.meta_title, fallback.meta_title)`.as("meta_title"),
      sql<string | null>`coalesce(t.meta_description, fallback.meta_description)`.as("meta_description"),
    ])
    .where("content_pages.slug", "=", slug)
    .where("content_pages.status", "=", "published")
    .executeTakeFirst();

  if (!page?.title) return null;
  return {
    id: page.id,
    slug: page.slug,
    template: page.template,
    title: page.title,
    body: page.body ?? "",
    metaTitle: page.meta_title,
    metaDescription: page.meta_description,
  };
}

export async function listContentPages() {
  return db.selectFrom("content_pages").selectAll().orderBy("slug", "asc").execute();
}

export async function getFaqs(locale: Locale) {
  const rows = await db
    .selectFrom("faqs")
    .selectAll()
    .where("status", "=", "active")
    .orderBy("sort_order", "asc")
    .execute();
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    question: locale === "th" ? row.question_th : row.question_en,
    answer: locale === "th" ? row.answer_th : row.answer_en,
  }));
}

export async function getCareGuides(locale: Locale) {
  const rows = await db
    .selectFrom("care_guides as g")
    .leftJoin("care_guide_translations as t", (join) =>
      join.onRef("t.guide_id", "=", "g.id").on("t.locale", "=", locale),
    )
    .leftJoin("care_guide_translations as fallback", (join) =>
      join.onRef("fallback.guide_id", "=", "g.id").on("fallback.locale", "=", "th"),
    )
    .select([
      "g.id",
      "g.slug",
      "g.image_url",
      sql<string | null>`coalesce(t.title, fallback.title)`.as("title"),
      sql<string | null>`coalesce(t.body, fallback.body)`.as("body"),
    ])
    .where("g.status", "=", "published")
    .orderBy("g.sort_order", "asc")
    .execute();
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    imageUrl: row.image_url,
    title: row.title ?? row.slug,
    body: row.body ?? "",
  }));
}

export type BlogCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string | null;
  publishedAt: string | null;
};

export async function listBlogPosts(locale: Locale, options: { limit?: number; offset?: number } = {}) {
  const rows = await db
    .selectFrom("blog_posts as p")
    .leftJoin("blog_post_translations as t", (join) =>
      join.onRef("t.post_id", "=", "p.id").on("t.locale", "=", locale),
    )
    .leftJoin("blog_post_translations as fallback", (join) =>
      join.onRef("fallback.post_id", "=", "p.id").on("fallback.locale", "=", "th"),
    )
    .select([
      "p.id",
      "p.slug",
      "p.cover_image",
      "p.category",
      "p.published_at",
      sql<string | null>`coalesce(t.title, fallback.title)`.as("title"),
      sql<string | null>`coalesce(t.excerpt, fallback.excerpt)`.as("excerpt"),
    ])
    .where("p.status", "=", "published")
    .orderBy("p.published_at", "desc")
    .limit(options.limit ?? 12)
    .offset(options.offset ?? 0)
    .execute();

  return rows.map<BlogCard>((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title ?? row.slug,
    excerpt: row.excerpt,
    coverImage: row.cover_image,
    category: row.category,
    publishedAt: row.published_at,
  }));
}

export async function getBlogPost(slug: string, locale: Locale) {
  const row = await db
    .selectFrom("blog_posts as p")
    .leftJoin("blog_post_translations as t", (join) =>
      join.onRef("t.post_id", "=", "p.id").on("t.locale", "=", locale),
    )
    .leftJoin("blog_post_translations as fallback", (join) =>
      join.onRef("fallback.post_id", "=", "p.id").on("fallback.locale", "=", "th"),
    )
    .leftJoin("users as author", "author.id", "p.author_id")
    .select([
      "p.id",
      "p.slug",
      "p.cover_image",
      "p.category",
      "p.published_at",
      "author.name as author_name",
      sql<string | null>`coalesce(t.title, fallback.title)`.as("title"),
      sql<string | null>`coalesce(t.excerpt, fallback.excerpt)`.as("excerpt"),
      sql<string | null>`coalesce(t.content, fallback.content)`.as("content"),
      sql<string | null>`coalesce(t.meta_title, fallback.meta_title)`.as("meta_title"),
      sql<string | null>`coalesce(t.meta_description, fallback.meta_description)`.as("meta_description"),
    ])
    .where("p.slug", "=", slug)
    .where("p.status", "=", "published")
    .executeTakeFirst();

  if (!row?.title) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content ?? "",
    coverImage: row.cover_image,
    category: row.category,
    publishedAt: row.published_at,
    authorName: row.author_name,
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
  };
}

export async function getGallery() {
  return db
    .selectFrom("site_gallery")
    .selectAll()
    .where("status", "=", "active")
    .orderBy("sort_order", "asc")
    .limit(8)
    .execute();
}

export type ReviewSummary = {
  id: string;
  rating: number;
  body: string | null;
  authorName: string;
  createdAt: string;
  productSlug: string;
  productName: string;
  adminReply: string | null;
};

export async function getReviewAggregate(): Promise<{ average: number; count: number }> {
  const row = await db
    .selectFrom("reviews")
    .select(({ fn }) => [fn.avg<number>("rating").as("avg"), fn.countAll<string>().as("count")])
    .where("status", "=", "approved")
    .where("verified", "=", 1)
    .executeTakeFirst();
  const count = Number(row?.count ?? 0);
  return { average: count > 0 ? Math.round(Number(row?.avg ?? 0) * 10) / 10 : 0, count };
}

export async function getHomepageReviews(locale: Locale, limit = 6): Promise<ReviewSummary[]> {
  const rows = await db
    .selectFrom("reviews as r")
    .innerJoin("users as u", "u.id", "r.user_id")
    .innerJoin("products as p", "p.id", "r.product_id")
    .leftJoin("product_translations as pt", (join) =>
      join.onRef("pt.product_id", "=", "p.id").on("pt.locale", "=", locale),
    )
    .leftJoin("product_translations as fallback", (join) =>
      join.onRef("fallback.product_id", "=", "p.id").on("fallback.locale", "=", "th"),
    )
    .select([
      "r.id",
      "r.rating",
      "r.body",
      "r.created_at",
      "r.admin_reply",
      "u.name as author_name",
      "p.slug as product_slug",
      sql<string | null>`coalesce(pt.name, fallback.name)`.as("product_name"),
    ])
    .where("r.status", "=", "approved")
    .where("r.verified", "=", 1)
    .orderBy("r.created_at", "desc")
    .limit(limit)
    .execute();

  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    body: row.body,
    authorName: maskName(row.author_name),
    createdAt: row.created_at,
    productSlug: row.product_slug,
    productName: row.product_name ?? row.product_slug,
    adminReply: row.admin_reply,
  }));
}

export function maskName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "BLOOMÉ customer";
  if (trimmed.includes(" ")) {
    const parts = trimmed.split(/\s+/);
    return `${parts[0]} ${parts[1]?.slice(0, 1) ?? ""}.`;
  }
  return trimmed.length > 2 ? `${trimmed.slice(0, 2)}…` : trimmed;
}

export async function getProductReviews(productId: string) {
  const rows = await db
    .selectFrom("reviews as r")
    .innerJoin("users as u", "u.id", "r.user_id")
    .select(["r.id", "r.rating", "r.body", "r.title", "r.created_at", "r.admin_reply", "u.name as author_name"])
    .where("r.product_id", "=", productId)
    .where("r.status", "=", "approved")
    .orderBy("r.created_at", "desc")
    .limit(30)
    .execute();

  const ids = rows.map((row) => row.id);
  const images = ids.length
    ? await db.selectFrom("review_images").selectAll().where("review_id", "in", ids).execute()
    : [];
  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    adminReply: row.admin_reply,
    authorName: maskName(row.author_name),
    verified: true,
    images: images.filter((image) => image.review_id === row.id).map((image) => image.url),
  }));
}
