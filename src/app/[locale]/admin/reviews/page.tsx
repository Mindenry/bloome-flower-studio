import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "kysely";
import { AdminPageHeader } from "@/components/admin/ui";
import { Badge, RatingStars } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/time";
import { firstParam, type RawSearchParams } from "@/lib/shop-params";
import { moderateReviewAction, replyReviewFormAction } from "@/app/actions/admin-marketing";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.REVIEW_MODERATE);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const sp = await searchParams;
  const status = firstParam(sp, "status") ?? "pending";

  const reviews = await db
    .selectFrom("reviews as r")
    .innerJoin("users as u", "u.id", "r.user_id")
    .leftJoin("product_translations as pt", (join) =>
      join.onRef("pt.product_id", "=", "r.product_id").on("pt.locale", "=", locale),
    )
    .select([
      "r.id",
      "r.rating",
      "r.title",
      "r.body",
      "r.status",
      "r.admin_reply",
      "r.created_at",
      "u.name as author",
      "u.email as author_email",
      "pt.name as product_name",
      sql<string | null>`(select slug from products where id = r.product_id)`.as("product_slug"),
    ])
    .$if(status !== "all", (qb) => qb.where("r.status", "=", status))
    .orderBy("r.created_at", "desc")
    .limit(100)
    .execute();

  const counts = await db
    .selectFrom("reviews")
    .select(["status", ({ fn }) => fn.countAll<string>().as("count")])
    .groupBy("status")
    .execute();
  const countMap = new Map(counts.map((row) => [row.status, Number(row.count ?? 0)]));

  return (
    <div>
      <AdminPageHeader title={t("admin.reviews")} description={locale === "th" ? "รีวิวจากผู้ซื้อจริงเท่านั้น" : "Verified-purchase reviews only."} />

      <div className="mb-4 flex flex-wrap gap-1 border border-line bg-white p-1 text-[11px]">
        {["pending", "approved", "rejected", "all"].map((value) => (
          <Link
            key={value}
            href={`/${locale}/admin/reviews?status=${value}`}
            className={`px-3 py-1.5 ${status === value ? "bg-primary text-white" : "text-muted hover:bg-cream"}`}
          >
            {value} ({value === "all" ? [...countMap.values()].reduce((a, b) => a + b, 0) : countMap.get(value) ?? 0})
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {reviews.map((review) => (
          <article key={review.id} className="border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <RatingStars value={review.rating} />
                  <Badge tone={review.status === "approved" ? "success" : review.status === "rejected" ? "danger" : "warning"}>
                    {t(`status.${review.status}` as never)}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {review.author} · {review.author_email} · {formatDateTime(review.created_at, locale)}
                </p>
                <p className="mt-1 text-[11px]">
                  {review.product_name ?? "—"}{" "}
                  {review.product_slug ? (
                    <Link href={`/${locale}/product/${review.product_slug}`} target="_blank" className="text-primary-dark underline underline-offset-2">
                      ↗
                    </Link>
                  ) : null}
                </p>
              </div>
              <div className="flex gap-2 text-[11px]">
                {review.status !== "approved" ? (
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="status" value="approved" />
                    <button type="submit" className="btn btn-primary btn-sm">
                      {t("status.approved")}
                    </button>
                  </form>
                ) : null}
                {review.status !== "rejected" ? (
                  <form action={moderateReviewAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <button type="submit" className="btn btn-ghost btn-sm">
                      {t("status.rejected")}
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
            {review.title ? <p className="mt-3 font-medium">{review.title}</p> : null}
            <p className="mt-1 text-sm text-muted">{review.body}</p>
            {review.admin_reply ? (
              <div className="mt-3 border-l-2 border-primary bg-primary-soft px-3 py-2 text-xs">
                <p className="text-[9px] uppercase tracking-wider text-primary-dark">BLOOMÉ reply</p>
                {review.admin_reply}
              </div>
            ) : null}
            <form action={replyReviewFormAction} className="mt-3 flex gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={review.id} />
              <input name="reply" defaultValue={review.admin_reply ?? ""} placeholder={locale === "th" ? "ตอบกลับลูกค้า" : "Reply to customer"} className="input h-8 flex-1 text-xs" maxLength={1500} />
              <button type="submit" className="btn btn-ghost btn-sm">
                {t("common.save")}
              </button>
            </form>
          </article>
        ))}
        {reviews.length === 0 ? <p className="border border-line bg-white px-4 py-8 text-center text-xs text-muted">{t("common.empty")}</p> : null}
      </div>
    </div>
  );
}
