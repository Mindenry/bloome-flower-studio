import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, can } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/rbac";
import { storeImage } from "@/lib/uploads";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!can(user, PERMISSIONS.PRODUCT_UPDATE) && !can(user, PERMISSIONS.CONTENT_MANAGE)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const limit = await rateLimit(`upload:${user.id}`, 60, 3600);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const formData = await request.formData();
  const file = formData.get("file");
  const prefix = String(formData.get("prefix") ?? "products").replace(/[^a-z0-9-]/gi, "").slice(0, 20) || "products";

  if (!(file instanceof File)) return NextResponse.json({ error: "validation.required" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "validation.fileSize" }, { status: 413 });

  const result = await storeImage(file, { prefix, userId: user.id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ image: result.image }, { status: 201 });
}
