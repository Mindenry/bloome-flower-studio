import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader, AdminTable } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { listActivity } from "@/lib/audit";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/time";
import { firstParam, type RawSearchParams } from "@/lib/shop-params";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.ACTIVITY_VIEW);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const sp = await searchParams;
  const page = Math.max(1, Number(firstParam(sp, "page") ?? 1) || 1);
  const result = await listActivity({ page, perPage: 40 });

  return (
    <div>
      <AdminPageHeader title={t("admin.activity")} description={`${result.total} ${t("common.results")}`} />
      <AdminTable head={[t("common.date"), "Actor", "Action", "Entity", "IP"]}>
        {result.items.map((row) => (
          <tr key={row.id}>
            <td className="px-3 py-2.5 text-[10px] text-muted">{formatDateTime(row.created_at, locale)}</td>
            <td className="px-3 py-2.5 text-[11px]">{row.actor_email ?? row.actor_id?.slice(-8) ?? "system"}</td>
            <td className="px-3 py-2.5 text-[11px]">{row.action}</td>
            <td className="px-3 py-2.5 text-[10px] text-muted">
              {row.entity_type}
              {row.entity_id ? ` · ${row.entity_id.slice(-8)}` : ""}
            </td>
            <td className="px-3 py-2.5 text-[10px] text-muted">{row.ip ?? "—"}</td>
          </tr>
        ))}
        {result.items.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-8 text-center text-xs text-muted">
              {t("common.empty")}
            </td>
          </tr>
        ) : null}
      </AdminTable>
      {result.total > result.perPage ? (
        <div className="mt-4 flex gap-1 text-[11px]">
          {Array.from({ length: Math.ceil(result.total / result.perPage) }).slice(0, 20).map((_, index) => (
            <Link
              key={index}
              href={`/${locale}/admin/activity?page=${index + 1}`}
              className={`flex h-7 min-w-7 items-center justify-center border px-2 ${
                page === index + 1 ? "border-primary bg-primary text-white" : "border-line bg-white"
              }`}
            >
              {index + 1}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
