import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export type StoredFile = { key: string; url: string; size: number; mime: string };

function publicUrl(key: string): string {
  if (env.storage.driver === "s3") {
    if (env.storage.s3PublicUrl) return `${env.storage.s3PublicUrl.replace(/\/$/, "")}/${key}`;
    if (env.storage.s3Endpoint) {
      return `${env.storage.s3Endpoint.replace(/\/$/, "")}/${env.storage.s3Bucket}/${key}`;
    }
    return `https://${env.storage.s3Bucket}.s3.${env.storage.s3Region}.amazonaws.com/${key}`;
  }
  return `${env.storage.publicPrefix.replace(/\/$/, "")}/${key}`;
}

export function storageKey(prefix: string, extension: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}/${yyyy}/${mm}/${Date.now().toString(36)}-${random}.${extension}`;
}

export async function putFile(key: string, body: Buffer, contentType: string): Promise<StoredFile> {
  if (env.storage.driver === "s3") {
    if (!env.storage.s3Bucket) throw new Error("S3_BUCKET is not configured");
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: env.storage.s3Region,
      endpoint: env.storage.s3Endpoint || undefined,
      forcePathStyle: Boolean(env.storage.s3Endpoint),
      credentials:
        env.storage.s3AccessKeyId && env.storage.s3SecretAccessKey
          ? {
              accessKeyId: env.storage.s3AccessKeyId,
              secretAccessKey: env.storage.s3SecretAccessKey,
            }
          : undefined,
    });
    await client.send(
      new PutObjectCommand({
        Bucket: env.storage.s3Bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
        ACL: "public-read",
      }),
    );
    return { key, url: publicUrl(key), size: body.byteLength, mime: contentType };
  }

  const root = path.resolve(process.cwd(), env.storage.uploadDir);
  const target = path.join(root, key);
  if (!target.startsWith(root)) throw new Error("invalid_storage_key");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
  return { key, url: publicUrl(key), size: body.byteLength, mime: contentType };
}

export async function removeFile(key: string): Promise<void> {
  if (env.storage.driver === "s3") {
    if (!env.storage.s3Bucket) return;
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      region: env.storage.s3Region,
      endpoint: env.storage.s3Endpoint || undefined,
      forcePathStyle: Boolean(env.storage.s3Endpoint),
      credentials:
        env.storage.s3AccessKeyId && env.storage.s3SecretAccessKey
          ? { accessKeyId: env.storage.s3AccessKeyId, secretAccessKey: env.storage.s3SecretAccessKey }
          : undefined,
    });
    await client.send(new DeleteObjectCommand({ Bucket: env.storage.s3Bucket, Key: key }));
    return;
  }
  const root = path.resolve(process.cwd(), env.storage.uploadDir);
  const target = path.join(root, key);
  if (!target.startsWith(root)) return;
  await unlink(target).catch(() => undefined);
}

export function storageStatus() {
  return {
    driver: env.storage.driver,
    configured:
      env.storage.driver === "s3"
        ? Boolean(env.storage.s3Bucket && env.storage.s3AccessKeyId)
        : true,
  };
}
