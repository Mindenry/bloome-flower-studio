import { rmSync, mkdirSync } from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db";

/** Drops all tables in a SQLite development database. Refuses to run on PostgreSQL. */
async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/bloome.db";
  if (url.startsWith("postgres")) {
    console.error("[reset] refusing to reset a PostgreSQL database. Drop it manually if that is really intended.");
    process.exit(1);
  }
  const file = path.resolve(process.cwd(), url.replace(/^file:/, ""));
  rmSync(file, { force: true });
  rmSync(`${file}-wal`, { force: true });
  rmSync(`${file}-shm`, { force: true });
  mkdirSync(path.dirname(file), { recursive: true });
  const db = getDb();
  await db.destroy();
  console.log(`[reset] removed ${file}`);
}

main().catch((error) => {
  console.error("[reset] failed", error);
  process.exit(1);
});
