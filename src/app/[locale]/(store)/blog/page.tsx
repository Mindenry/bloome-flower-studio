import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listBlogPosts } from "@/lib/content";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "th";
  return {
    title: translate(locale, "nav.blog"),
    description:
      locale === "th"
        ? "บทความเกี่ยวกับดอกไม้ การดูแล และแรงบันดาลใจจากสตูดิโอ BLOOMÉ"
        : "Flower stories, care notes and inspiration from the BLOOMÉ studio.",
    alternates: { canonical: `/${locale}/blog` },
  };
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const posts = await listBlogPosts(locale, { limit: 12 });

  return (
    <div className="container-page py-12 md:py-16">
      <p className="eyebrow text-center">{t("nav.blog")}</p>
      <h1 className="mt-3 text-center text-[32px] sm:text-[40px]">
        {locale === "th" ? "จดหมายจากสตูดิโอ" : "Notes from the studio"}
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted">
        {locale === "th"
          ? "เรื่องราวดอกไม้ ความหมาย และวิธีดูแลที่เราอยากแบ่งปัน"
          : "Flower stories, symbolism and care notes we love to share."}
      </p>

      <div className="mt-12 grid gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <article key={post.id} className="group">
            <Link href={`/${locale}/blog/${post.slug}`}>
              <div className="relative aspect-[4/3] overflow-hidden bg-[#f1efe8]">
                {post.coverImage ? (
                  <Image
                    src={post.coverImage}
                    alt={post.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : null}
              </div>
              <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-muted">
                {post.category ?? (locale === "th" ? "บทความ" : "Journal")}
                {post.publishedAt ? ` · ${formatDate(post.publishedAt, locale, { dateStyle: "medium" })}` : ""}
              </p>
              <h2 className="mt-2 font-serif text-xl leading-snug transition-colors group-hover:text-primary-dark">{post.title}</h2>
              {post.excerpt ? <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{post.excerpt}</p> : null}
            </Link>
          </article>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="mt-12 text-center text-sm text-muted">{t("common.empty")}</p>
      ) : null}
    </div>
  );
}
