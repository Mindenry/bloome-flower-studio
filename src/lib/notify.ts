import { db, nowIso } from "@/lib/db";
import { env } from "@/lib/env";
import { ids } from "@/lib/ids";
import type { Locale } from "@/lib/i18n/config";

export type NotifyPayload = {
  titleTh: string;
  titleEn: string;
  bodyTh?: string | null;
  bodyEn?: string | null;
  linkUrl?: string | null;
};

/** Creates an in-app notification for a customer. */
export async function notifyCustomer(userId: string, type: string, payload: NotifyPayload): Promise<void> {
  await db
    .insertInto("notifications")
    .values({
      id: ids.notification(),
      user_id: userId,
      audience: "customer",
      type,
      title_th: payload.titleTh,
      title_en: payload.titleEn,
      body_th: payload.bodyTh ?? null,
      body_en: payload.bodyEn ?? null,
      link_url: payload.linkUrl ?? null,
      read_at: null,
      created_at: nowIso(),
    })
    .execute();
}

/** Broadcasts an in-app notification to every staff member with an admin audience row. */
export async function notifyAdmins(type: string, payload: NotifyPayload): Promise<void> {
  await db
    .insertInto("notifications")
    .values({
      id: ids.notification(),
      user_id: null,
      audience: "admin",
      type,
      title_th: payload.titleTh,
      title_en: payload.titleEn,
      body_th: payload.bodyTh ?? null,
      body_en: payload.bodyEn ?? null,
      link_url: payload.linkUrl ?? null,
      read_at: null,
      created_at: nowIso(),
    })
    .execute();
}

/**
 * LINE Messaging API push. Requires a *Messaging API* channel access token
 * (separate from the LINE Login channel) and a linked LINE account id.
 */
export async function sendLinePush(lineUserId: string, messages: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!env.line.messagingToken) return { ok: false, error: "line_messaging_not_configured" };
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.line.messagingToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: messages.slice(0, 5).map((text) => ({ type: "text", text: text.slice(0, 5000) })),
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      const body = await response.text();
      return { ok: false, error: `line_error:${response.status}:${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function lineUserIdFor(userId: string): Promise<string | null> {
  const account = await db
    .selectFrom("accounts")
    .select("provider_account_id")
    .where("user_id", "=", userId)
    .where("provider", "=", "line")
    .executeTakeFirst();
  return account?.provider_account_id ?? null;
}

/** Order lifecycle fan-out: in-app always, email + LINE when configured/consented. */
export async function notifyOrderEvent(params: {
  userId: string | null;
  email: string;
  locale: Locale;
  type: string;
  payload: NotifyPayload;
  lineMessage?: string;
}): Promise<void> {
  if (params.userId) {
    await notifyCustomer(params.userId, params.type, params.payload);
  }
  if (params.lineMessage && params.userId) {
    const lineId = await lineUserIdFor(params.userId);
    if (lineId) await sendLinePush(lineId, [params.lineMessage]);
  }
}
