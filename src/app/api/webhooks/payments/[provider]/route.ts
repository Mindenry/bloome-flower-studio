import { NextResponse, type NextRequest } from "next/server";
import { applyPaymentWebhook } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Provider webhooks. The body is read raw because signatures are computed over
 * the exact bytes; parsing first would break verification.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const rawBody = await request.text();
  if (rawBody.length > 200_000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const query: Record<string, string> = {};
  new URL(request.url).searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const result = await applyPaymentWebhook(provider, { rawBody, headers, query });
  return NextResponse.json({ ok: result.ok, message: result.message }, { status: result.status });
}

export async function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
