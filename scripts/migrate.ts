import { getDb } from "../src/lib/db";
import { runMigrations } from "../src/lib/db/migrations";
import { env } from "../src/lib/env";

async function main() {
  console.log(`[migrate] target=${env.databaseUrl.replace(/:\/\/[^@]*@/, "://***@")}`);
  const db = getDb();
  const executed = await runMigrations(db);
  if (executed.length === 0) console.log("[migrate] database already up to date");
  else for (const name of executed) console.log(`[migrate] applied ${name}`);
  await db.destroy();
}

main().catch((error) => {
  console.error("[migrate] failed", error);
  process.exit(1);
});
