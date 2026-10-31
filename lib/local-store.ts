import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { State } from "./store.ts";
import { initialState } from "./store.ts";
let db: DatabaseSync;
export function localTransaction<T>(fn: (state: State) => T): T {
  if (!db) {
    mkdirSync(join(process.cwd(), ".data"), { recursive: true });
    const filename = process.env.DISCOVERY_DB_FILE || "discovery.sqlite";
    if (!/^[a-zA-Z0-9_-]+\.sqlite$/.test(filename))
      throw Error("INVALID_DATABASE_FILENAME");
    db = new DatabaseSync(join(process.cwd(), ".data", filename));
    db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL)",
    );
    db.prepare("INSERT OR IGNORE INTO state VALUES(1,?)").run(
      JSON.stringify(initialState()),
    );
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT value FROM state WHERE id=1").get() as {
      value: string;
    };
    const state = JSON.parse(row.value) as State;
    const result = fn(state);
    if (result instanceof Promise) throw Error("ASYNC_TRANSACTION_CALLBACK");
    const serialized = JSON.stringify(state);
    if (serialized !== row.value)
      db.prepare("UPDATE state SET value=? WHERE id=1").run(serialized);
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
