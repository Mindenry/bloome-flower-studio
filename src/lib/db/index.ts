import { mkdirSync } from "node:fs";
import path from "node:path";
import { Kysely, PostgresDialect, type LogEvent } from "kysely";
import { Pool } from "pg";
import { env } from "@/lib/env";
import { NodeSqliteDialect } from "./sqlite-dialect";
import type { Database } from "./schema";

export type { Database };

const globalForDb = globalThis as unknown as { __bloomeDb?: Kysely<Database> };

function resolveSqliteFile(url: string): string {
  const file = url.replace(/^file:/, "");
  const absolute = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  return absolute;
}

function createDb(): Kysely<Database> {
  const url = env.databaseUrl;
  const logger =
    env.nodeEnv === "development"
      ? (event: LogEvent) => {
          if (event.level === "error") console.error("[sql]", event.query.sql, event.error);
          else if (event.queryDurationMillis > 250) {
            console.warn("[sql:slow]", Math.round(event.queryDurationMillis), "ms", event.query.sql);
          }
        }
      : undefined;

  if (url.startsWith("postgres")) {
    // pg is a server-only dependency (listed in serverExternalPackages).
    const pool = new Pool({
      connectionString: url,
      max: 10,
      ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
    });
    return new Kysely<Database>({ dialect: new PostgresDialect({ pool }), log: logger });
  }

  return new Kysely<Database>({
    dialect: new NodeSqliteDialect(resolveSqliteFile(url)),
    log: logger,
  });
}

export function getDb(): Kysely<Database> {
  if (!globalForDb.__bloomeDb) globalForDb.__bloomeDb = createDb();
  return globalForDb.__bloomeDb;
}

export const db = new Proxy({} as Kysely<Database>, {
  get(_target, property) {
    const instance = getDb() as unknown as Record<string | symbol, unknown>;
    const value = instance[property];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export function isPostgres(): boolean {
  return env.databaseUrl.startsWith("postgres");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

export function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

export function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}
