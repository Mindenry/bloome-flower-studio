import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui";
import { getBlogPost, listBlogPosts } from "@/lib/content";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/time";
import { env } from "@/lib/env";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale: Locale = isLocale(raw) ? raw : "th";
  const post = await getBlogPost(slug, locale);
  if (!post) return { title: translate(locale, "common.notFound") };
  return {
    title: post.metaTitle ?? post.title,
    description: post.metaDescription ?? post.excerpt ?? undefined,
    alternates: {
      canonical: `${env.appUrl}/${locale}/blog/${post.slug}`,
      languages: {
        th: `${env.appUrl}/th/blog/${post.slug}`,
        en: `${env.appUrl}/en/blog/${post.slug}`,
      },
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.coverImage ? [post.coverImage] : undefined,
      publishedTime: post.publishedAt ?? undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const [post, related] = await Promise.all([getBlogPost(slug, locale), listBlogPosts(locale, { limit: 3 })]);
  if (!post) notFound();

  const shareUrl = encodeURIComponent(`${env.appUrl}/${locale}/blog/${post.slug}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.coverImage ? `${env.appUrl}${post.coverImage}` : undefined,
    datePublished: post.publishedAt ?? undefined,
    author: { "@type": "Person", name: post.authorName ?? "BLOOMÉ FLOWER STUDIO" },
    publisher: { "@type": "Organization", name: "BLOOMÉ FLOWER STUDIO" },
  };

  return (
    <article className="container-page py-10 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs
          items={[
            { label: t("nav.home"), href: `/${locale}` },
            { label: t("nav.blog"), href: `/${locale}/blog` },
            { label: post.title },
          ]}
        />
        <p className="eyebrow">
          {post.category ?? (locale === "th" ? "บทความ" : "Journal")}
          {post.publishedAt ? ` · ${formatDate(post.publishedAt, locale, { dateStyle: "long" })}` : ""}
        </p>
        <h1 className="mt-3 text-[32px] leading-[1.25] sm:text-[42px]">{post.title}</h1>
        {post.authorName ? <p className="mt-3 text-xs text-muted">{post.authorName}</p> : null}

        {post.coverImage ? (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden bg-[#f1efe8]">
            <Image src={post.coverImage} alt={post.title} fill priority sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
          </div>
        ) : null}

        <div className="prose-editorial mt-8">
          {post.content.split("\n\n").map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3 border-y border-line py-4 text-xs text-muted">
          <span>{t("common.share")}:</span>
          <a
            href={`https://social-plugins.line.me/lineit/share?url=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-primary-dark"
          >
            LINE
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-primary-dark"
          >
            Facebook
          </a>
          <a
            href={`https://twitter.com/intent/tweet?url=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-primary-dark"
          >
            X
          </a>
          <Link href={`/${locale}/contact`} className="ml-auto text-primary-dark underline underline-offset-2">
            {t("nav.contact")}
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-5xl">
        <h2 className="text-center font-serif text-2xl">{t("nav.blog")}</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {related
            .filter((item) => item.slug !== post.slug)
            .slice(0, 2)
            .map((item) => (
              <Link key={item.id} href={`/${locale}/blog/${item.slug}`} className="group">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#f1efe8]">
                  {item.coverImage ? (
                    <Image src={item.coverImage} alt={item.title} fill sizes="33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : null}
                </div>
                <h3 className="mt-3 font-serif text-lg group-hover:text-primary-dark">{item.title}</h3>
              </Link>
            ))}
        </div>
      </div>
    </article>
  );
}
