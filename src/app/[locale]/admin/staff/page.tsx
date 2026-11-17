import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader, AdminTable } from "@/components/admin/ui";
import { StaffForm } from "@/components/admin/staff-forms";
import { Badge } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { translate } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/time";
import { toggleStaffStatusAction, updateStaffRoleAction } from "@/app/actions/admin-staff";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminStaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const current = await requirePermission(locale, PERMISSIONS.STAFF_MANAGE);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);

  const [roles, staff] = await Promise.all([
    db.selectFrom("roles").select(["id", "slug", "name"]).where("slug", "!=", "customer").orderBy("name", "asc").execute(),
    db
      .selectFrom("users")
      .innerJoin("roles", "roles.id", "users.role_id")
      .select([
        "users.id",
        "users.name",
        "users.email",
        "users.status",
        "users.last_login_at",
        "users.created_at",
        "roles.slug as role_slug",
        "roles.name as role_name",
        "roles.id as role_id",
      ])
      .where("roles.slug", "!=", "customer")
      .where("users.deleted_at", "is", null)
      .orderBy("users.created_at", "asc")
      .execute(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title={t("admin.staff")}
        description={locale === "th" ? "บัญชีพนักงานและสิทธิ์การเข้าถึง" : "Staff accounts and access."}
      />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <AdminTable head={[t("auth.name"), "Role", t("common.status"), "Last login", ""]}>
          {staff.map((member) => (
            <tr key={member.id}>
              <td className="px-3 py-2.5">
                <span className="block">{member.name}</span>
                <span className="block text-[10px] text-muted">{member.email}</span>
              </td>
              <td className="px-3 py-2.5">
                <form action={updateStaffRoleAction} className="flex items-center gap-1">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="userId" value={member.id} />
                  <select name="roleId" defaultValue={member.role_id} className="input h-7 w-auto text-[10px]" disabled={member.id === current.id}>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="text-[10px] text-primary-dark underline underline-offset-2" disabled={member.id === current.id}>
                    {t("common.save")}
                  </button>
                </form>
              </td>
              <td className="px-3 py-2.5">
                <Badge tone={member.status === "active" ? "success" : "danger"}>{t(`status.${member.status}` as never)}</Badge>
              </td>
              <td className="px-3 py-2.5 text-[10px] text-muted">
                {member.last_login_at ? formatDateTime(member.last_login_at, locale) : "—"}
              </td>
              <td className="px-3 py-2.5">
                {member.id === current.id ? (
                  <span className="text-[10px] text-muted">—</span>
                ) : (
                  <form action={toggleStaffStatusAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="userId" value={member.id} />
                    <button type="submit" className={`text-[10px] underline underline-offset-2 ${member.status === "active" ? "text-danger" : "text-success"}`}>
                      {member.status === "active" ? t("status.disabled") : t("status.active")}
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </AdminTable>

        <section className="border border-line bg-white p-4">
          <h2 className="mb-3 text-sm font-medium">{locale === "th" ? "เพิ่มพนักงาน" : "Add staff member"}</h2>
          <StaffForm locale={locale} roles={roles.map((role) => ({ id: role.id, name: role.name }))} />
        </section>
      </div>
    </div>
  );
}
