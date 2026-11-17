import type { Kysely } from "kysely";
import { db, nowIso } from "@/lib/db";
import type { Database } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { DEFAULT_SLOT_TEMPLATES, type SlotTemplate } from "@/lib/defaults";

export type { SlotTemplate };
import type { Locale } from "@/lib/i18n/config";
import { addDaysToDateString, bangkokDateString, bangkokTimeParts, weekdayOfDateString } from "@/lib/time";

export type DeliverySlotView = {
  id: string | null;
  start: string;
  end: string;
  label: string;
  capacity: number;
  remaining: number;
  closed: boolean;
};

export type DeliveryDay = {
  date: string;
  closed: boolean;
  reason: string | null;
  slots: DeliverySlotView[];
};

export function slotIdFor(date: string, start: string): string {
  return `dsl_${date.replace(/-/g, "")}_${start.replace(":", "")}`;
}

async function resolveTemplates(): Promise<SlotTemplate[]> {
  const settings = await getSettings();
  const configured = (settings.shipping as unknown as { slotTemplates?: SlotTemplate[] }).slotTemplates;
  if (Array.isArray(configured) && configured.length > 0) return configured;
  return DEFAULT_SLOT_TEMPLATES;
}

/**
 * Builds the bookable delivery calendar for the next `days` days using live
 * capacity from the delivery_slots table (which is materialised on booking).
 */
export async function getDeliveryCalendar(locale: Locale, days?: number): Promise<DeliveryDay[]> {
  void locale;
  const settings = await getSettings();
  const templates = await resolveTemplates();
  const totalDays = Math.min(60, Math.max(1, days ?? settings.shipping.maxDaysAhead));

  const today = bangkokDateString();
  const now = bangkokTimeParts();
  const dates: string[] = [];
  for (let i = 0; i < totalDays; i += 1) dates.push(addDaysToDateString(today, i * 1));

  const [blocked, slots] = await Promise.all([
    db
      .selectFrom("delivery_blocked_dates")
      .selectAll()
      .where("date", "in", dates)
      .execute(),
    db
      .selectFrom("delivery_slots")
      .selectAll()
      .where("date", "in", dates)
      .execute(),
  ]);
  const blockedMap = new Map(blocked.map((row) => [row.date, row.reason]));
  const slotMap = new Map(slots.map((row) => [`${row.date}|${row.start_time}`, row]));

  const result: DeliveryDay[] = [];
  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index];
    const weekday = weekdayOfDateString(date);
    const closedWeekday = settings.shipping.closedWeekdays.includes(weekday);
    const blockedReason = blockedMap.get(date) ?? null;
    const isToday = date === today;

    if (index === 0 && isToday && !settings.shipping.sameDayEnabled) {
      result.push({ date, closed: true, reason: "same_day_disabled", slots: [] });
      continue;
    }
    if (!isToday && index < Math.max(1, settings.shipping.leadDays)) {
      result.push({ date, closed: true, reason: "lead_time", slots: [] });
      continue;
    }
    if (closedWeekday || blockedReason !== null) {
      result.push({ date, closed: true, reason: blockedReason ?? "closed_day", slots: [] });
      continue;
    }

    const daySlots: DeliverySlotView[] = [];
    for (const template of templates) {
      const row = slotMap.get(`${date}|${template.start}`);
      const capacity = row?.capacity ?? template.capacity;
      const booked = row?.booked_count ?? 0;
      const startHour = Number(template.start.split(":")[0]);
      const pastCutoff = isToday && now.hours >= settings.shipping.cutoffHour;
      const startPassed = isToday && now.hours >= startHour;
      const closed = row?.status === "closed" || pastCutoff || startPassed;
      daySlots.push({
        id: row?.id ?? null,
        start: template.start,
        end: template.end,
        label: `${template.start} – ${template.end}`,
        capacity,
        remaining: closed ? 0 : Math.max(0, capacity - booked),
        closed,
      });
    }
    result.push({ date, closed: false, reason: null, slots: daySlots });
  }

  // Same-day eligibility: keep today visible but closed when after the cut-off.
  return result;
}

export async function isDateBlocked(date: string): Promise<boolean> {
  const row = await db
    .selectFrom("delivery_blocked_dates")
    .select("id")
    .where("date", "=", date)
    .executeTakeFirst();
  return Boolean(row);
}

export function validateDeliveryDate(
  date: string,
  settings: Awaited<ReturnType<typeof getSettings>>,
): { ok: boolean; reason?: string } {
  const today = bangkokDateString();
  const max = addDaysToDateString(today, settings.shipping.maxDaysAhead);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, reason: "error.dateInvalid" };
  if (date < today) return { ok: false, reason: "error.dateInvalid" };
  if (date > max) return { ok: false, reason: "error.dateInvalid" };
  if (date === today) {
    if (!settings.shipping.sameDayEnabled) return { ok: false, reason: "error.dateInvalid" };
    const now = bangkokTimeParts();
    if (now.hours >= settings.shipping.cutoffHour) return { ok: false, reason: "error.slotFull" };
  } else {
    const lead = addDaysToDateString(today, Math.max(1, settings.shipping.leadDays));
    if (date < lead) return { ok: false, reason: "error.dateInvalid" };
  }
  if (settings.shipping.closedWeekdays.includes(weekdayOfDateString(date))) {
    return { ok: false, reason: "error.dateInvalid" };
  }
  return { ok: true };
}

/**
 * Atomically reserves capacity for one order inside the checkout transaction.
 * Returns the slot id, or null when the window is full/closed.
 */
export async function reserveSlot(
  tx: Kysely<Database>,
  params: { date: string; start: string; end: string; capacity: number },
): Promise<string | null> {
  const client = tx;
  const id = slotIdFor(params.date, params.start);
  const now = nowIso();
  const existing = await client
    .selectFrom("delivery_slots")
    .select(["id", "capacity", "booked_count", "status"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!existing) {
    try {
      await client
        .insertInto("delivery_slots")
        .values({
          id,
          date: params.date,
          start_time: params.start,
          end_time: params.end,
          capacity: params.capacity,
          booked_count: 1,
          status: "open",
          created_at: now,
          updated_at: now,
        })
        .execute();
      return id;
    } catch {
      return reserveSlot(client, params);
    }
  }

  if (existing.status === "closed") return null;
  const updated = await client
    .updateTable("delivery_slots")
    .set((eb) => ({ booked_count: eb("booked_count", "+", 1), updated_at: now }))
    .where("id", "=", id)
    .where("booked_count", "<", existing.capacity)
    .returning("id")
    .executeTakeFirst();
  return updated ? id : null;
}

export async function releaseSlot(slotId: string | null): Promise<void> {
  if (!slotId) return;
  await db
    .updateTable("delivery_slots")
    .set((eb) => ({ booked_count: eb("booked_count", "-", 1), updated_at: nowIso() }))
    .where("id", "=", slotId)
    .where("booked_count", ">", 0)
    .execute();
}

export function slotLabel(start: string, end: string): string {
  return `${start} – ${end}`;
}
