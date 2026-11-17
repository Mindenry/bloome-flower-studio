"use client";

import { useActionState } from "react";
import { createStaffAction, saveRoleAction } from "@/app/actions/admin-staff";
import type { FormState } from "@/lib/schemas";
import { useI18n } from "../i18n-provider";

const initial: FormState = { ok: false };

export function StaffForm({ locale, roles }: { locale: string; roles: Array<{ id: string; name: string }> }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(createStaffAction, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="staff-name">{t("auth.name")}</label>
          <input id="staff-name" name="name" required className="input h-9 text-xs" />
          {state.fieldErrors?.name ? <p className="field-error">{state.fieldErrors.name}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="staff-email">{t("auth.email")}</label>
          <input id="staff-email" name="email" type="email" required className="input h-9 text-xs" />
          {state.fieldErrors?.email ? <p className="field-error">{state.fieldErrors.email}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="staff-role">{t("admin.roles")}</label>
          <select id="staff-role" name="roleId" className="input h-9 text-xs">
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="staff-password">{t("auth.password")}</label>
          <input id="staff-password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input h-9 text-xs" />
          {state.fieldErrors?.password ? <p className="field-error">{state.fieldErrors.password}</p> : null}
        </div>
      </div>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-xs text-success">{state.message}</p> : null}
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t("common.saving") : t("common.create")}
      </button>
    </form>
  );
}

export function RoleForm({
  locale,
  role,
  groups,
}: {
  locale: string;
  role?: { id: string; name: string; slug: string; description: string; permissions: string[] } | null;
  groups: Array<{ group: string; permissions: string[] }>;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveRoleAction, initial);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="locale" value={locale} />
      {role ? <input type="hidden" name="id" value={role.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="role-name">Name</label>
          <input id="role-name" name="name" defaultValue={role?.name} required className="input h-9 text-xs" />
        </div>
        <div>
          <label className="label" htmlFor="role-slug">Slug</label>
          <input id="role-slug" name="slug" defaultValue={role?.slug} required className="input h-9 text-xs font-mono" readOnly={Boolean(role)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="role-desc">Description</label>
          <input id="role-desc" name="description" defaultValue={role?.description} className="input h-9 text-xs" />
        </div>
      </div>
      <div className="space-y-3">
        {groups.map((group) => (
          <fieldset key={group.group}>
            <legend className="label">{group.group}</legend>
            <div className="flex flex-wrap gap-3">
              {group.permissions.map((permission) => (
                <label key={permission} className="flex items-center gap-1.5 text-[11px]">
                  <input
                    type="checkbox"
                    name="permissions"
                    value={permission}
                    defaultChecked={role?.permissions.includes(permission) || role?.permissions.includes("*")}
                    className="accent-[#81917B]"
                  />
                  {permission}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-xs text-success">{state.message}</p> : null}
      <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </button>
    </form>
  );
}
