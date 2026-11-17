import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentSchemaVersion } from "@/lib/db/migrations";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.selectFrom("roles").select("id").limit(1).execute();
    return NextResponse.json({
      status: "ok",
      time: new Date().toISOString(),
      schema: await currentSchemaVersion(db),
      environment: env.nodeEnv,
      paymentProvider: env.payments.provider,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: (error as Error).message.slice(0, 200) },
      { status: 503 },
    );
  }
}
