import { cache } from "react";
import { db, nowIso } from "@/lib/db";
import { env } from "@/lib/env";
import { SETTING_DEFAULTS, type StoreSettings } from "@/lib/defaults";

export type { StoreSettings };
export { SETTING_DEFAULTS };

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function mergeDefaults(raw: Record<string, string>): StoreSettings {
  const result = structuredClone(SETTING_DEFAULTS);
  for (const [key, value] of Object.entries(raw)) {
    const [group, field] = key.split(".");
    if (!group || !field) continue;
    const groupValue = (result as unknown as Record<string, Record<string, unknown>>)[group];
    if (!groupValue) continue;
    try {
      groupValue[field] = JSON.parse(value);
    } catch {
      groupValue[field] = value;
    }
  }
  // Environment overrides keep secrets out of the admin UI.
  if (env.payments.bank.name) result.payment.bankName = env.payments.bank.name;
  if (env.payments.bank.accountName) result.payment.bankAccountName = env.payments.bank.accountName;
  if (env.payments.bank.accountNumber) result.payment.bankAccountNumber = env.payments.bank.accountNumber;
  return result;
}

export const getSettings = cache(async (): Promise<StoreSettings> => {
  const rows = await db.selectFrom("store_settings").select(["key", "value"]).execute();
  const raw: Record<string, string> = {};
  for (const row of rows) raw[row.key] = row.value;
  return mergeDefaults(raw);
});

/** Non-cached read for places that must observe a just-written value (e.g. after save). */
export async function getSettingsFresh(): Promise<StoreSettings> {
  const rows = await db.selectFrom("store_settings").select(["key", "value"]).execute();
  const raw: Record<string, string> = {};
  for (const row of rows) raw[row.key] = row.value;
  return mergeDefaults(raw);
}

export async function updateSettings(patch: DeepPartial<StoreSettings>): Promise<void> {
  const now = nowIso();
  const statements: Array<{ key: string; value: string }> = [];
  for (const [group, fields] of Object.entries(patch)) {
    if (!fields) continue;
    for (const [field, value] of Object.entries(fields as Record<string, unknown>)) {
      statements.push({ key: `${group}.${field}`, value: JSON.stringify(value) });
    }
  }
  if (statements.length === 0) return;

  for (const statement of statements) {
    const existing = await db
      .selectFrom("store_settings")
      .select("key")
      .where("key", "=", statement.key)
      .executeTakeFirst();
    if (existing) {
      await db
        .updateTable("store_settings")
        .set({ value: statement.value, updated_at: now })
        .where("key", "=", statement.key)
        .execute();
    } else {
      await db
        .insertInto("store_settings")
        .values({ key: statement.key, value: statement.value, updated_at: now })
        .execute();
    }
  }
}

export async function getRawSetting(key: string): Promise<string | null> {
  const row = await db.selectFrom("store_settings").select("value").where("key", "=", key).executeTakeFirst();
  return row?.value ?? null;
}

export async function setRawSetting(key: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  const now = nowIso();
  const existing = await db.selectFrom("store_settings").select("key").where("key", "=", key).executeTakeFirst();
  if (existing) {
    await db.updateTable("store_settings").set({ value: serialized, updated_at: now }).where("key", "=", key).execute();
  } else {
    await db.insertInto("store_settings").values({ key, value: serialized, updated_at: now }).execute();
  }
}
