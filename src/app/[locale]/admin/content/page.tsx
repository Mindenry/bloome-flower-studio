import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/ui";
import { BannerForm, FaqForm, GalleryForm, PageForm } from "@/components/admin/content-forms";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { firstParam, type RawSearchParams } from "@/lib/shop-params";
import { deleteBannerAction, deleteFaqAction, deleteGalleryAction, deletePageAction } from "@/app/actions/admin-content";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const TABS = ["banners", "pages", "faq", "gallery"] as const;

export default async function AdminContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.CONTENT_MANAGE);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(firstParam(sp, "tab") ?? "") ? (firstParam(sp, "tab") as (typeof TABS)[number]) : "banners";
  const editId = firstParam(sp, "edit");

  const [banners, pages, faqs, gallery] = await Promise.all([
    db.selectFrom("banners").selectAll().orderBy("placement", "asc").orderBy("sort_order", "asc").execute(),
    db
      .selectFrom("content_pages")
      .leftJoin("content_page_translations as th", (join) =>
        join.onRef("th.page_id", "=", "content_pages.id").on("th.locale", "=", "th"),
      )
      .leftJoin("content_page_translations as en", (join) =>
        join.onRef("en.page_id", "=", "content_pages.id").on("en.locale", "=", "en"),
      )
      .select([
        "content_pages.id",
        "content_pages.slug",
        "content_pages.template",
        "content_pages.status",
        "th.title as title_th",
        "en.title as title_en",
        "th.body as body_th",
        "en.body as body_en",
        "th.meta_title as meta_title_th",
        "en.meta_title as meta_title_en",
        "th.meta_description as meta_description_th",
        "en.meta_description as meta_description_en",
      ])
      .orderBy("content_pages.slug", "asc")
      .execute(),
    db.selectFrom("faqs").selectAll().orderBy("sort_order", "asc").execute(),
    db.selectFrom("site_gallery").selectAll().orderBy("sort_order", "asc").execute(),
  ]);

  const editingBanner = editId ? banners.find((banner) => banner.id === editId) : null;
  const editingPage = editId ? pages.find((page) => page.id === editId) : null;
  const editingFaq = editId ? faqs.find((faq) => faq.id === editId) : null;

  return (
    <div>
      <AdminPageHeader
        title={t("admin.content")}
        description={locale === "th" ? "แบนเนอร์ หน้าเว็บ คำถามที่พบบ่อย และแกลเลอรี" : "Banners, pages, FAQs and the social gallery."}
      />

      <div className="mb-4 flex flex-wrap gap-1 border border-line bg-white p-1 text-[11px]">
        {TABS.map((value) => (
          <Link
            key={value}
            href={`/${locale}/admin/content?tab=${value}`}
            className={`px-3 py-1.5 ${tab === value ? "bg-primary text-white" : "text-muted hover:bg-cream"}`}
          >
            {value}
          </Link>
        ))}
      </div>

      {tab === "banners" ? (
        <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <div className="space-y-2">
            {banners.map((banner) => (
              <div key={banner.id} className="flex flex-wrap items-center justify-between gap-2 border border-line bg-white px-4 py-3 text-[12px]">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{banner.placement}</p>
                  <p>{banner.title_th}</p>
                  <p className="text-[11px] text-muted">{banner.title_en}</p>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className={banner.status === "active" ? "text-success" : "text-muted"}>{banner.status}</span>
                  <Link href={`/${locale}/admin/content?tab=banners&edit=${banner.id}`} className="text-primary-dark underline underline-offset-2">
                    {t("common.edit")}
                  </Link>
                  <form action={deleteBannerAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={banner.id} />
                    <button type="submit" className="text-danger underline underline-offset-2">
                      {t("common.delete")}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
          <div className="border border-line bg-white p-4">
            <h2 className="mb-3 text-sm font-medium">{editingBanner ? t("common.edit") : t("common.create")}</h2>
            <BannerForm
              locale={locale}
              banner={
                editingBanner
                  ? {
                      id: editingBanner.id,
                      placement: editingBanner.placement,
                      titleTh: editingBanner.title_th,
                      titleEn: editingBanner.title_en,
                      subtitleTh: editingBanner.subtitle_th ?? "",
                      subtitleEn: editingBanner.subtitle_en ?? "",
                      imageUrl: editingBanner.image_url ?? "",
                      linkUrl: editingBanner.link_url ?? "",
                      ctaTh: editingBanner.cta_th ?? "",
                      ctaEn: editingBanner.cta_en ?? "",
                      sortOrder: editingBanner.sort_order,
                      status: editingBanner.status,
                      startsAt: editingBanner.starts_at ?? "",
                      endsAt: editingBanner.ends_at ?? "",
                    }
                  : null
              }
            />
          </div>
        </div>
      ) : null}

      {tab === "pages" ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
          <div className="space-y-1">
            {pages.map((page) => (
              <div key={page.id} className="flex items-center justify-between gap-2 border border-line bg-white px-3 py-2 text-[12px]">
                <Link href={`/${locale}/admin/content?tab=pages&edit=${page.id}`} className="hover:text-primary-dark">
                  <span className="font-mono text-[10px] text-muted">/{page.slug}</span>
                  <span className="block">{page.title_th}</span>
                </Link>
                <div className="flex items-center gap-2">
                  <Link href={`/${locale}/policies/${page.slug}`} target="_blank" className="text-[10px] text-muted underline underline-offset-2">
                    ↗
                  </Link>
                  <form action={deletePageAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={page.id} />
                    <button type="submit" className="text-[10px] text-danger underline underline-offset-2">
                      {t("common.delete")}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
          <div className="border border-line bg-white p-4">
            <PageForm
              locale={locale}
              page={
                editingPage
                  ? {
                      id: editingPage.id,
                      slug: editingPage.slug,
                      template: editingPage.template,
                      status: editingPage.status,
                      titleTh: editingPage.title_th ?? "",
                      titleEn: editingPage.title_en ?? "",
                      bodyTh: editingPage.body_th ?? "",
                      bodyEn: editingPage.body_en ?? "",
                      metaTitleTh: editingPage.meta_title_th ?? "",
                      metaTitleEn: editingPage.meta_title_en ?? "",
                      metaDescriptionTh: editingPage.meta_description_th ?? "",
                      metaDescriptionEn: editingPage.meta_description_en ?? "",
                    }
                  : null
              }
            />
          </div>
        </div>
      ) : null}

      {tab === "faq" ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
          <div className="space-y-1">
            {faqs.map((faq) => (
              <div key={faq.id} className="flex items-center justify-between gap-2 border border-line bg-white px-3 py-2 text-[12px]">
                <Link href={`/${locale}/admin/content?tab=faq&edit=${faq.id}`} className="hover:text-primary-dark">
                  {faq.question_th}
                </Link>
                <form action={deleteFaqAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="id" value={faq.id} />
                  <button type="submit" className="text-[10px] text-danger underline underline-offset-2">
                    {t("common.delete")}
                  </button>
                </form>
              </div>
            ))}
          </div>
          <div className="border border-line bg-white p-4">
            <FaqForm
              locale={locale}
              faq={
                editingFaq
                  ? {
                      id: editingFaq.id,
                      category: editingFaq.category ?? "",
                      questionTh: editingFaq.question_th,
                      questionEn: editingFaq.question_en,
                      answerTh: editingFaq.answer_th,
                      answerEn: editingFaq.answer_en,
                      sortOrder: editingFaq.sort_order,
                      status: editingFaq.status,
                    }
                  : null
              }
            />
          </div>
        </div>
      ) : null}

      {tab === "gallery" ? (
        <div>
          <div className="border border-line bg-white p-4">
            <h2 className="mb-3 text-sm font-medium">{t("home.social.title")}</h2>
            <GalleryForm locale={locale} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {gallery.map((image) => (
              <div key={image.id} className="border border-line bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.image_url} alt={image.caption ?? ""} className="aspect-square w-full object-cover" loading="lazy" />
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="truncate text-muted">{image.caption ?? "—"}</span>
                  <form action={deleteGalleryAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={image.id} />
                    <button type="submit" className="text-danger underline underline-offset-2">
                      {t("common.delete")}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
