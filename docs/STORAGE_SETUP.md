# Storage setup

Product, review, banner and blog images are stored in object storage; the database only keeps metadata and URLs.

## Development (local disk)

```env
STORAGE_DRIVER=local
UPLOAD_DIR=./public/uploads
PUBLIC_UPLOAD_PREFIX=/uploads
```

Files are written under `public/uploads/<prefix>/<yyyy>/<mm>/<random>.webp` and served by Next.js as static assets. The folder is git-ignored; seed images live in `public/uploads/seed`.

## Production (S3-compatible)

```env
STORAGE_DRIVER=s3
S3_BUCKET=bloome-media
S3_REGION=ap-southeast-1
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_PUBLIC_URL=https://cdn.example.com     # optional CDN base
# For Cloudflare R2 / MinIO:
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
```

- Path-style addressing is enabled automatically when `S3_ENDPOINT` is set (required by R2/MinIO).
- Objects are uploaded with `public, max-age=31536000, immutable` and `public-read`. If your bucket blocks ACLs (R2), keep the bucket public via a custom domain and remove the ACL requirement in your bucket policy — the app still returns `S3_PUBLIC_URL`.
- Recommended bucket policy: public read for `products/*`, `content/*`, `reviews/*`; no listing.

## Upload pipeline

1. Admin form posts to `POST /api/uploads` (session + `products.update` or `content.manage`).
2. Rejections: missing file, > 8 MB, or content sniffed by sharp as not JPEG/PNG/WebP.
3. The file is re-encoded to **WebP**, max width 2000 px, quality 82 — this strips EXIF, embedded scripts and animation frames.
4. Metadata (`storage_key`, URL, mime, size, dimensions, uploader) is written to `uploads`.
5. The returned URL is attached to the product/content by the save action.

Client-supplied MIME types and file names are never trusted. SVG uploads are rejected by design (SVG can carry scripts).

## Image delivery

- Local driver: Next.js `<Image>` optimisation with AVIF/WebP output.
- S3 driver: use a CDN in front of the bucket; the app does not proxy bytes.
- Remote patterns are intentionally open (`https://**`) because the admin can paste CDN URLs, while uploads still pass through the validated pipeline.

## Migration between drivers

1. Copy existing objects from `public/uploads/<key>` to the bucket preserving the key path (`products/2026/11/...`).
2. Update `store_settings`/records? **No change needed** — only `uploads.url` and content URLs matter.
3. Run a SQL update if you need to rewrite old `/uploads/...` URLs to the CDN base:
   ```sql
   UPDATE product_images SET url = replace(url, '/uploads/', 'https://cdn.example.com/') WHERE url LIKE '/uploads/%';
   ```
   Repeat for `banners`, `blog_posts.cover_image`, `site_gallery`, `care_guides`, `review_images`, `users.avatar_url`.
4. Switch `STORAGE_DRIVER=s3` and restart.

## Retention

`uploads` rows are deleted when an admin removes a product image through the product form (files are deleted too). Orphaned objects from interrupted uploads can be found by comparing `uploads.storage_key` against the bucket listing.
