import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader, AdminTable } from "@/components/admin/ui";
import { BlogForm } from "@/components/admin/content-forms";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/time";
import { firstParam, type RawSearchParams } from "@/lib/shop-params";
import { deleteBlogPostAction } from "@/app/actions/admin-content";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminBlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.BLOG_MANAGE);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const sp = await searchParams;
  const editId = firstParam(sp, "edit");

  const posts = await db
    .selectFrom("blog_posts")
    .leftJoin("blog_post_translations as th", (join) =>
      join.onRef("th.post_id", "=", "blog_posts.id").on("th.locale", "=", "th"),
    )
    .leftJoin("blog_post_translations as en", (join) =>
      join.onRef("en.post_id", "=", "blog_posts.id").on("en.locale", "=", "en"),
    )
    .select([
      "blog_posts.id",
      "blog_posts.slug",
      "blog_posts.status",
      "blog_posts.category",
      "blog_posts.cover_image",
      "blog_posts.published_at",
      "th.title as title_th",
      "en.title as title_en",
      "th.excerpt as excerpt_th",
      "en.excerpt as excerpt_en",
      "th.content as content_th",
      "en.content as content_en",
      "th.meta_title as meta_title_th",
      "en.meta_title as meta_title_en",
      "th.meta_description as meta_description_th",
      "en.meta_description as meta_description_en",
    ])
    .orderBy("blog_posts.created_at", "desc")
    .execute();

  const editing = editId ? posts.find((post) => post.id === editId) : null;

  return (
    <div>
      <AdminPageHeader
        title={t("admin.blog")}
        description={locale === "th" ? "บทความภาษาไทยและอังกฤษ" : "Bilingual journal articles."}
        actions={
          <Link href={`/${locale}/admin/blog`} className="btn btn-primary btn-sm">
            {t("common.create")}
          </Link>
        }
      />

      <AdminTable head={[locale === "th" ? "บทความ" : "Post", "Slug", t("common.status"), t("common.date"), ""]}>
        {posts.map((post) => (
          <tr key={post.id}>
            <td className="px-3 py-2.5">
              <span className="block">{post.title_th}</span>
              <span className="block text-[10px] text-muted">{post.title_en}</span>
            </td>
            <td className="px-3 py-2.5 font-mono text-[10px]">{post.slug}</td>
            <td className="px-3 py-2.5 text-[11px]">{t(`status.${post.status}` as never)}</td>
            <td className="px-3 py-2.5 text-[10px] text-muted">{post.published_at ? formatDate(post.published_at, locale, { dateStyle: "medium" }) : "—"}</td>
            <td className="px-3 py-2.5">
              <div className="flex items-center gap-2 text-[11px]">
                <Link href={`/${locale}/admin/blog?edit=${post.id}`} className="text-primary-dark underline underline-offset-2">
                  {t("common.edit")}
                </Link>
                <Link href={`/${locale}/blog/${post.slug}`} target="_blank" className="text-muted underline underline-offset-2">
                  {t("common.preview")}
                </Link>
                <form action={deleteBlogPostAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={post.id} />
                  <button type="submit" className="text-danger underline underline-offset-2">
                    {t("common.delete")}
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
        {posts.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-8 text-center text-xs text-muted">
              {t("common.empty")}
            </td>
          </tr>
        ) : null}
      </AdminTable>

      <section className="mt-5 border border-line bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">{editing ? t("common.edit") : t("common.create")}</h2>
        <BlogForm
          locale={locale}
          post={
            editing
              ? {
                  id: editing.id,
                  slug: editing.slug,
                  category: editing.category ?? "",
                  coverImage: editing.cover_image ?? "",
                  status: editing.status,
                  titleTh: editing.title_th ?? "",
                  titleEn: editing.title_en ?? "",
                  excerptTh: editing.excerpt_th ?? "",
                  excerptEn: editing.excerpt_en ?? "",
                  contentTh: editing.content_th ?? "",
                  contentEn: editing.content_en ?? "",
                  metaTitleTh: editing.meta_title_th ?? "",
                  metaTitleEn: editing.meta_title_en ?? "",
                  metaDescriptionTh: editing.meta_description_th ?? "",
                  metaDescriptionEn: editing.meta_description_en ?? "",
                }
              : null
          }
        />
      </section>
    </div>
  );
}
