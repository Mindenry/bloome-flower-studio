import sharp, { type Metadata } from "sharp";
import { db, nowIso } from "@/lib/db";
import { ids } from "@/lib/ids";
import { putFile, removeFile, storageKey } from "@/lib/storage";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["jpeg", "png", "webp"]);

export type UploadedImage = {
  id: string;
  url: string;
  key: string;
  width: number;
  height: number;
  mime: string;
  size: number;
};

export type UploadFailure = { ok: false; error: string };
export type UploadSuccess = { ok: true; image: UploadedImage };
export type UploadResult = UploadSuccess | UploadFailure;

/**
 * Validates, re-encodes and stores an image.
 * - Never trusts the client MIME type: sharp sniffs the real bytes.
 * - Re-encoding strips EXIF, embedded payloads and animated frames.
 */
export async function storeImage(
  file: File,
  options: { prefix: string; userId: string | null; maxWidth?: number },
): Promise<UploadResult> {
  if (!file || file.size === 0) return { ok: false, error: "validation.required" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "validation.fileSize" };

  const input = Buffer.from(await file.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    return { ok: false, error: "validation.fileType" };
  }
  if (!metadata.format || !ALLOWED.has(metadata.format)) {
    return { ok: false, error: "validation.fileType" };
  }
  if (!metadata.width || !metadata.height) return { ok: false, error: "validation.fileType" };
  if (metadata.width > 9000 || metadata.height > 9000) return { ok: false, error: "validation.fileType" };

  const maxWidth = options.maxWidth ?? 2000;
  const pipeline = sharp(input, { limitInputPixels: 40_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .resize({ width: maxWidth, withoutEnlargement: true, fit: "inside" })
    .webp({ quality: 82, effort: 4 });

  const output = await pipeline.toBuffer({ resolveWithObject: true });
  const key = storageKey(options.prefix, "webp");
  const stored = await putFile(key, output.data, "image/webp");

  const id = ids.upload();
  await db
    .insertInto("uploads")
    .values({
      id,
      storage_key: key,
      url: stored.url,
      mime_type: "image/webp",
      size_bytes: stored.size,
      width: output.info.width,
      height: output.info.height,
      uploaded_by: options.userId,
      created_at: nowIso(),
    })
    .execute();

  return {
    ok: true,
    image: {
      id,
      url: stored.url,
      key,
      width: output.info.width,
      height: output.info.height,
      mime: "image/webp",
      size: stored.size,
    },
  };
}

export async function deleteStoredImage(url: string): Promise<void> {
  const upload = await db.selectFrom("uploads").select("storage_key").where("url", "=", url).executeTakeFirst();
  if (!upload) return;
  await removeFile(upload.storage_key);
  await db.deleteFrom("uploads").where("storage_key", "=", upload.storage_key).execute();
}

export const UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp";
