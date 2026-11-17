import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { locales } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "",
  "/shop",
  "/about",
  "/contact",
  "/faq",
  "/blog",
  "/care-guide",
  "/flower-finder",
  "/photo-credits",
  "/order/track",
  "/policies/privacy-policy",
  "/policies/terms",
  "/policies/shipping-policy",
  "/policies/returns",
  "/policies/cookie-policy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.appUrl;
  const now = new Date();

  const [products, categories, posts, pages] = await Promise.all([
    db
      .selectFrom("products")
      .select(["slug", "updated_at"])
      .where("status", "=", "published")
      .where("deleted_at", "is", null)
      .execute(),
    db
      .selectFrom("categories")
      .select(["slug", "kind", "updated_at"])
      .where("status", "=", "active")
      .where("deleted_at", "is", null)
      .execute(),
    db
      .selectFrom("blog_posts")
      .select(["slug", "updated_at"])
      .where("status", "=", "published")
      .execute(),
    db.selectFrom("content_pages").select(["slug", "updated_at"]).where("status", "=", "published").execute(),
  ]);

  const entries: MetadataRoute.Sitemap = [];

  const push = (path: string, lastModified: Date, priority: number, changeFrequency: "daily" | "weekly" | "monthly") => {
    for (const locale of locales) {
      entries.push({
        url: `${base}/${locale}${path}`,
        lastModified,
        changeFrequency,
        priority,
        alternates: {
          languages: {
            th: `${base}/th${path}`,
            en: `${base}/en${path}`,
          },
        },
      });
    }
  };

  for (const path of STATIC_PATHS) push(path, now, path === "" ? 1 : 0.6, "weekly");
  for (const product of products) push(`/product/${product.slug}`, new Date(product.updated_at), 0.8, "daily");
  for (const category of categories) {
    push(`/${category.kind === "occasion" ? "occasion" : "category"}/${category.slug}`, new Date(category.updated_at), 0.7, "weekly");
  }
  for (const post of posts) push(`/blog/${post.slug}`, new Date(post.updated_at), 0.5, "monthly");
  for (const page of pages) {
    if (page.slug === "about" || page.slug === "contact") continue;
    push(`/policies/${page.slug}`, new Date(page.updated_at), 0.3, "monthly");
  }

  return entries;
}
