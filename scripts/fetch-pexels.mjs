/** Downloads curated Pexels photos (free licence) and creates optimised WebP assets. */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ids = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scripts", "pexels-ids.json"), "utf8"));
const outDir = path.join(process.cwd(), "public", "images", "demo");
fs.mkdirSync(outDir, { recursive: true });

const manifest = {};
const used = new Set();
const LIMIT = 10;

for (const [key, list] of Object.entries(ids)) {
  const picked = [];
  for (const id of list) {
    if (picked.length >= LIMIT) break;
    if (used.has(id)) continue;
    const url = `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`;
    try {
      let response;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        response = await fetch(url, { headers: { "user-agent": "bloome-seed/1.0" } });
        if (response.ok) break;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
      if (!response || !response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      const meta = await sharp(buffer).metadata();
      if (!meta.width || meta.width < 900) continue;
      const output = await sharp(buffer).rotate().resize({ width: 1500, withoutEnlargement: true }).webp({ quality: 84, effort: 4 }).toBuffer();
      const filename = `${key}-${String(picked.length + 1).padStart(2, "0")}.webp`;
      fs.writeFileSync(path.join(outDir, filename), output);
      used.add(id);
      picked.push({ id, file: `/images/demo/${filename}`, w: meta.width, h: meta.height });
      console.log(`${key} ${filename} ${meta.width}x${meta.height} #${id}`);
    } catch {
      /* skip */
    }
  }
  manifest[key] = picked;
}

fs.writeFileSync(path.join(process.cwd(), "public", "photo-credits.json"), JSON.stringify(manifest, null, 2));
console.log("total", Object.values(manifest).reduce((s, l) => s + l.length, 0));
