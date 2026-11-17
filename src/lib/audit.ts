import { db, json, nowIso } from "@/lib/db";
import { ids } from "@/lib/ids";
import type { SessionUser } from "@/lib/auth/session";

export async function logActivity(params: {
  actor: SessionUser | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  try {
    await db
      .insertInto("activity_logs")
      .values({
        id: ids.activity(),
        actor_id: params.actor?.id ?? null,
        actor_email: params.actor?.email ?? params.actorEmail ?? null,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId ?? null,
        meta_json: params.meta ? json(params.meta).slice(0, 8000) : null,
        ip: params.ip ?? null,
        created_at: nowIso(),
      })
      .execute();
  } catch (error) {
    console.error("[audit] failed to write activity log", (error as Error).message);
  }
}

export async function listActivity(params: { page?: number; perPage?: number; actorId?: string }) {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, params.perPage ?? 30);
  let query = db.selectFrom("activity_logs");
  if (params.actorId) query = query.where("actor_id", "=", params.actorId);
  const count = await query.select(({ fn }) => fn.countAll<string>().as("count")).executeTakeFirst();
  const rows = await query
    .selectAll()
    .orderBy("created_at", "desc")
    .limit(perPage)
    .offset((page - 1) * perPage)
    .execute();
  return { items: rows, total: Number(count?.count ?? 0), page, perPage };
}
