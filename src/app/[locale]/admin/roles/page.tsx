import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/ui";
import { RoleForm } from "@/components/admin/staff-forms";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS, PERMISSION_GROUPS } from "@/lib/auth/rbac";
import { db, parseJson } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { firstParam, type RawSearchParams } from "@/lib/shop-params";
import { deleteRoleAction } from "@/app/actions/admin-staff";
import { Badge } from "@/components/ui";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminRolesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  await requirePermission(locale, PERMISSIONS.STAFF_MANAGE);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const sp = await searchParams;
  const editId = firstParam(sp, "edit");

  const roles = await db.selectFrom("roles").selectAll().orderBy("is_system", "desc").orderBy("name", "asc").execute();
  const editing = editId ? roles.find((role) => role.id === editId) : null;

  const groups = PERMISSION_GROUPS.map((group) => ({
    group: group.group,
    permissions: group.permissions.map((permission) => String(permission)),
  }));

  return (
    <div>
      <AdminPageHeader
        title={t("admin.roles")}
        description={locale === "th" ? "สิทธิ์ถูกตรวจสอบฝั่งเซิร์ฟเวอร์ทุกครั้งที่เรียกใช้งาน" : "Permissions are enforced server-side on every request."}
        actions={
          <Link href={`/${locale}/admin/roles`} className="btn btn-primary btn-sm">
            {t("common.create")}
          </Link>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <div className="space-y-2">
          {roles.map((role) => {
            const permissions = parseJson<string[]>(role.permissions, []);
            return (
              <div key={role.id} className="border border-line bg-white p-3 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {role.name}{" "}
                      {role.is_system === 1 ? <Badge tone="neutral">system</Badge> : null}
                    </p>
                    <p className="text-[10px] text-muted">
                      {role.slug} · {role.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[10px]">
                    <Link href={`/${locale}/admin/roles?edit=${role.id}`} className="text-primary-dark underline underline-offset-2">
                      {t("common.edit")}
                    </Link>
                    {role.is_system === 0 ? (
                      <form action={deleteRoleAction}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={role.id} />
                        <button type="submit" className="text-danger underline underline-offset-2">
                          {t("common.delete")}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-muted">
                  {permissions.includes("*") ? "all permissions" : `${permissions.length} permissions`}
                </p>
              </div>
            );
          })}
        </div>

        <section className="border border-line bg-white p-4">
          <h2 className="mb-3 text-sm font-medium">{editing ? t("common.edit") : t("common.create")}</h2>
          <RoleForm
            locale={locale}
            groups={groups}
            role={
              editing
                ? {
                    id: editing.id,
                    name: editing.name,
                    slug: editing.slug,
                    description: editing.description ?? "",
                    permissions: parseJson<string[]>(editing.permissions, []),
                  }
                : null
            }
          />
        </section>
      </div>
    </div>
  );
}
