import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

export async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(73481901)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const name = "001_wall";
    const applied = await client.query("SELECT name FROM schema_migrations WHERE name=$1", [name]);
    if (!applied.rowCount) {
      await client.query(await readFile(new URL("../migrations/001_wall.sql", import.meta.url), "utf8"));
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
      console.log("Applied migration:", name);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); await pool.end(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await migrate();
}
