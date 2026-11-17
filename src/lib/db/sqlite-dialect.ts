import { DatabaseSync } from "node:sqlite";
import type {
  CompiledQuery,
  DatabaseConnection,
  DatabaseIntrospector,
  Dialect,
  DialectAdapter,
  Driver,
  Kysely,
  QueryCompiler,
  QueryResult,
  TransactionSettings,
} from "kysely";
import { SqliteAdapter, SqliteQueryCompiler } from "kysely";

/**
 * Kysely dialect backed by Node's built-in `node:sqlite`.
 * Requires zero native compilation, while remaining transaction safe:
 * every acquired connection is a dedicated DatabaseSync handle in WAL mode.
 */

function normalizeParams(params: readonly unknown[]): unknown[] {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value instanceof Date) return value.toISOString();
    return value;
  });
}

function returnsRows(compiled: CompiledQuery): boolean {
  const sql = compiled.sql.trimStart();
  const head = sql.slice(0, 12).toLowerCase();
  return (
    head.startsWith("select") ||
    head.startsWith("pragma") ||
    head.startsWith("explain") ||
    head.startsWith("with") ||
    / returning /i.test(compiled.sql)
  );
}

class NodeSqliteConnection implements DatabaseConnection {
  constructor(private readonly handle: DatabaseSync) {}

  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const statement = this.handle.prepare(compiled.sql);
    const parameters = normalizeParams(compiled.parameters) as never[];
    if (returnsRows(compiled)) {
      const rows = statement.all(...parameters) as R[];
      return { rows };
    }
    const result = statement.run(...parameters);
    return {
      rows: [],
      numAffectedRows: BigInt(result.changes ?? 0),
    };
  }

  async *streamQuery<R>(compiled: CompiledQuery): AsyncIterableIterator<QueryResult<R>> {
    yield await this.executeQuery<R>(compiled);
  }
}

class HandlePool {
  private readonly idle: DatabaseSync[] = [];
  private readonly waiting: Array<(handle: DatabaseSync) => void> = [];
  private readonly all = new Set<DatabaseSync>();
  private closed = false;

  constructor(
    private readonly file: string,
    private readonly maxSize = 6,
  ) {}

  private create(): DatabaseSync {
    const handle = new DatabaseSync(this.file);
    handle.exec("PRAGMA journal_mode = WAL");
    handle.exec("PRAGMA synchronous = NORMAL");
    handle.exec("PRAGMA busy_timeout = 10000");
    handle.exec("PRAGMA foreign_keys = ON");
    this.all.add(handle);
    return handle;
  }

  acquire(): Promise<DatabaseSync> {
    const available = this.idle.pop();
    if (available) return Promise.resolve(available);
    if (this.all.size < this.maxSize) return Promise.resolve(this.create());
    return new Promise<DatabaseSync>((resolve) => this.waiting.push(resolve));
  }

  release(handle: DatabaseSync): void {
    const waiting = this.waiting.shift();
    if (waiting) waiting(handle);
    else this.idle.push(handle);
  }

  closeAll(): void {
    if (this.closed) return;
    this.closed = true;
    for (const handle of this.all) {
      try {
        handle.close();
      } catch {
        /* already closed */
      }
    }
    this.all.clear();
    this.idle.length = 0;
  }
}

class NodeSqliteDriver implements Driver {
  private readonly pool: HandlePool;

  constructor(file: string) {
    this.pool = new HandlePool(file);
  }

  async init(): Promise<void> {
    const handle = await this.pool.acquire();
    this.pool.release(handle);
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    const handle = await this.pool.acquire();
    return new NodeSqliteConnection(handle);
  }

  async beginTransaction(connection: DatabaseConnection, _settings: TransactionSettings): Promise<void> {
    const handle = (connection as unknown as { handle: DatabaseSync }).handle;
    handle.exec("BEGIN IMMEDIATE");
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    const handle = (connection as unknown as { handle: DatabaseSync }).handle;
    handle.exec("COMMIT");
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    const handle = (connection as unknown as { handle: DatabaseSync }).handle;
    handle.exec("ROLLBACK");
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    const handle = (connection as unknown as { handle: DatabaseSync }).handle;
    this.pool.release(handle);
  }

  async destroy(): Promise<void> {
    this.pool.closeAll();
  }
}

class EmptyIntrospector implements DatabaseIntrospector {
  async getSchemas() {
    return [];
  }
  async getTables() {
    return [];
  }
  async getMetadata() {
    return { tables: [] };
  }
  async getColumns() {
    return [];
  }
}

export class NodeSqliteDialect implements Dialect {
  constructor(private readonly file: string) {}

  createAdapter(): DialectAdapter {
    return new SqliteAdapter();
  }

  createDriver(): Driver {
    return new NodeSqliteDriver(this.file);
  }

  createQueryCompiler(): QueryCompiler {
    return new SqliteQueryCompiler();
  }

  createIntrospector(_db: Kysely<unknown>): DatabaseIntrospector {
    return new EmptyIntrospector();
  }
}
