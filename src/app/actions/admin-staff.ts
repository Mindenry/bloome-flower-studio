"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, nowIso, parseJson } from "@/lib/db";
import { ids } from "@/lib/ids";
import { roleSchema, staffSchema, type FormState } from "@/lib/schemas";
import { getCurrentUser, can } from "@/lib/auth/session";
import { PERMISSIONS, ALL_PERMISSIONS } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { asLocale, type Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n";
import { logActivity } from "@/lib/audit";

async function guard(locale: Locale) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!can(user, PERMISSIONS.STAFF_MANAGE)) redirect(`/${locale}/admin?denied=1`);
  return user;
}

export async function createStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale);
  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    roleId: formData.get("roleId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "_form"] = translate(locale, issue.message as never);
    }
    return { ok: false, error: translate(locale, "error.validation"), fieldErrors };
  }
  const existing = await db.selectFrom("users").select("id").where("email", "=", parsed.data.email).executeTakeFirst();
  if (existing) return { ok: false, error: translate(locale, "auth.emailTaken") };

  const staffId = ids.user();
  const now = nowIso();
  await db
    .insertInto("users")
    .values({
      id: staffId,
      email: parsed.data.email,
      email_verified_at: now,
      password_hash: await hashPassword(parsed.data.password),
      name: parsed.data.name,
      phone: null,
      avatar_url: null,
      role_id: parsed.data.roleId,
      status: "active",
      locale,
      marketing_consent: 0,
      last_login_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })
    .execute();
  await logActivity({ actor: user, action: "staff.create", entityType: "user", entityId: staffId, meta: { email: parsed.data.email } });
  revalidatePath(`/${locale}/admin/staff`);
  return { ok: true, message: translate(locale, "admin.staffInvited") };
}

export async function updateStaffRoleAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale);
  const userId = String(formData.get("userId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  if (userId === user.id) return;
  await db.updateTable("users").set({ role_id: roleId, updated_at: nowIso() }).where("id", "=", userId).execute();
  await logActivity({ actor: user, action: "staff.role", entityType: "user", entityId: userId, meta: { roleId } });
  revalidatePath(`/${locale}/admin/staff`);
}

export async function toggleStaffStatusAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale);
  const userId = String(formData.get("userId") ?? "");
  if (userId === user.id) return;
  const row = await db.selectFrom("users").select(["status"]).where("id", "=", userId).executeTakeFirst();
  if (!row) return;
  const next = row.status === "active" ? "disabled" : "active";
  await db.updateTable("users").set({ status: next, updated_at: nowIso() }).where("id", "=", userId).execute();
  if (next === "disabled") await revokeAllSessions(userId);
  await logActivity({ actor: user, action: `staff.${next}`, entityType: "user", entityId: userId });
  revalidatePath(`/${locale}/admin/staff`);
}

export async function saveRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  const user = await guard(locale);
  const permissions = formData.getAll("permissions").map(String).filter((permission) => ALL_PERMISSIONS.includes(permission as never));
  const parsed = roleSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    permissions,
  });
  if (!parsed.success) {
    return { ok: false, error: translate(locale, "error.validation") };
  }
  const data = parsed.data;
  const now = nowIso();
  const roleId = data.id ?? ids.role();

  if (data.id) {
    const existing = await db.selectFrom("roles").select(["is_system", "slug"]).where("id", "=", data.id).executeTakeFirst();
    if (!existing) return { ok: false, error: translate(locale, "common.notFound") };
    if (existing.is_system === 1 && existing.slug !== "customer") {
      await db
        .updateTable("roles")
        .set({ name: data.name, description: data.description || null, permissions: JSON.stringify(data.permissions), updated_at: now })
        .where("id", "=", roleId)
        .execute();
    } else {
      await db
        .updateTable("roles")
        .set({
          name: data.name,
          description: data.description || null,
          permissions: JSON.stringify(data.permissions),
          updated_at: now,
        })
        .where("id", "=", roleId)
        .execute();
    }
  } else {
    const duplicate = await db.selectFrom("roles").select("id").where("slug", "=", data.slug).executeTakeFirst();
    if (duplicate) return { ok: false, error: translate(locale, "validation.slugUnique") };
    await db
      .insertInto("roles")
      .values({
        id: roleId,
        slug: data.slug,
        name: data.name,
        description: data.description || null,
        permissions: JSON.stringify(data.permissions),
        is_system: 0,
        created_at: now,
        updated_at: now,
      })
      .execute();
  }

  await logActivity({ actor: user, action: "role.save", entityType: "role", entityId: roleId, meta: { permissions: data.permissions } });
  revalidatePath(`/${locale}/admin/roles`);
  return { ok: true, message: translate(locale, "admin.roleSaved") };
}

export async function deleteRoleAction(formData: FormData): Promise<void> {
  const locale = asLocale(String(formData.get("locale") ?? "th"));
  await guard(locale);
  const id = String(formData.get("id") ?? "");
  const role = await db.selectFrom("roles").select(["is_system"]).where("id", "=", id).executeTakeFirst();
  if (!role || role.is_system === 1) return;
  const used = await db.selectFrom("users").select("id").where("role_id", "=", id).limit(1).executeTakeFirst();
  if (used) return;
  await db.deleteFrom("roles").where("id", "=", id).execute();
  revalidatePath(`/${locale}/admin/roles`);
}

export async function replaceUserPermissionsCheck(formData: FormData): Promise<void> {
  void parseJson;
  await updateStaffRoleAction(formData);
}
