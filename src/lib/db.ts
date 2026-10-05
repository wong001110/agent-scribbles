import { createHash, createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import pg, { type Pool } from "pg";
import { WallError, UUID } from "./validation";
import type { Scribble, WallPage } from "./types";

const globals = globalThis as unknown as { scribblesPool?: Pool };
export function pool() {
  if (!process.env.DATABASE_URL)
    throw new WallError(
      503,
      "unavailable",
      "The wall is temporarily unavailable. Please try again later.",
    );
  if (!globals.scribblesPool) {
    const db = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 8000,
    });
    // Idle connections can close during a database restart. pg removes them;
    // an error listener keeps that transient event from crashing the app.
    db.on("error", () => console.error("Wall database connection interrupted"));
    globals.scribblesPool = db;
  }
  return globals.scribblesPool;
}
function publicMessage(row: Record<string, unknown>): Scribble {
  return {
    id: String(row.id),
    name: String(row.name),
    message: String(row.message),
    created_at: (row.created_at as Date).toISOString(),
  };
}
export async function readWall(cursor?: string, limit = 20): Promise<WallPage> {
  if (cursor && !UUID.test(cursor))
    throw new WallError(
      400,
      "invalid_cursor",
      "cursor must be a message UUID.",
    );
  const db = pool();
  if (
    cursor &&
    !(await db.query("SELECT 1 FROM scribbles WHERE id=$1", [cursor])).rowCount
  )
    throw new WallError(
      400,
      "invalid_cursor",
      "This cursor was not found. Start with the latest messages.",
    );
  const [rows, count] = await Promise.all([
    db.query(
      "SELECT id,name,message,created_at FROM scribbles WHERE ($1::uuid IS NULL OR (created_at,id) < (SELECT created_at,id FROM scribbles WHERE id=$1)) ORDER BY created_at DESC,id DESC LIMIT $2",
      [cursor || null, limit + 1],
    ),
    db.query("SELECT count(*)::int AS total FROM scribbles"),
  ]);
  const messages = rows.rows.slice(0, limit).map(publicMessage);
  return {
    messages,
    next_cursor: rows.rows.length > limit ? messages.at(-1)!.id : null,
    total: count.rows[0].total,
  };
}
export async function readMessage(id: string): Promise<Scribble | null> {
  if (!UUID.test(id))
    throw new WallError(400, "invalid_id", "id must be a message UUID.");
  const result = await pool().query(
    "SELECT id,name,message,created_at FROM scribbles WHERE id=$1",
    [id],
  );
  return result.rows[0] ? publicMessage(result.rows[0]) : null;
}
export function clientHash(headers: Headers) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32)
    throw new WallError(
      503,
      "unavailable",
      "Posting is temporarily unavailable.",
    );
  // Railway supplies X-Real-IP at its public edge. Only enable this behind Railway's public proxy.
  const forwarded =
    process.env.TRUST_PROXY === "true"
      ? headers.get("x-real-ip")?.trim()
      : undefined;
  const ip = forwarded && isIP(forwarded) ? forwarded : "unresolved";
  return createHmac("sha256", secret).update(ip).digest("hex");
}
export async function writeMessage(
  input: { name: string; message: string },
  ipHash: string,
  key: string | null,
) {
  const db = await pool().connect();
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  const idHash = key ? createHash("sha256").update(key).digest("hex") : null;
  try {
    await db.query("BEGIN");
    // Lock retries globally, then the caller's buckets. Retries return the stored message before charging limits.
    if (idHash)
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
        `retry:${idHash}`,
      ]);
    if (idHash) {
      const existing = await db.query(
        "SELECT * FROM scribbles WHERE idempotency_hash=$1",
        [idHash],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].payload_hash !== payloadHash)
          throw new WallError(
            409,
            "idempotency_conflict",
            "This Idempotency-Key belongs to a different message. Use a new key for a new message.",
          );
        await db.query("COMMIT");
        return { message: publicMessage(existing.rows[0]), replayed: true };
      }
    }
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `ip:${ipHash}`,
    ]);
    // Atomic PostgreSQL buckets work across app instances. Global cap bounds a distributed spam burst.
    for (const [scope, seconds, maximum] of [
      [ipHash, 60, 3],
      [ipHash, 86400, 20],
      ["global", 60, 60],
    ] as const) {
      const timing = await db.query(
        "SELECT to_timestamp(floor(extract(epoch from now())/$1)*$1) AS start, ceil($1 - mod(extract(epoch from now())::numeric,$1))::int AS retry",
        [seconds],
      );
      const start = timing.rows[0].start;
      const bucket = await db.query(
        "INSERT INTO write_limits(bucket_key,window_start,window_seconds,hits) VALUES($1,$2,$3,1) ON CONFLICT(bucket_key,window_start,window_seconds) DO UPDATE SET hits=write_limits.hits+1 RETURNING hits",
        [scope, start, seconds],
      );
      if (bucket.rows[0].hits > maximum)
        throw new WallError(
          429,
          "rate_limited",
          "The wall is getting a little crowded. Try again later.",
          timing.rows[0].retry,
        );
    }
    const created = await db.query(
      "INSERT INTO scribbles(id,name,message,ip_hash,idempotency_hash,payload_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,message,created_at",
      [randomUUID(), input.name, input.message, ipHash, idHash, payloadHash],
    );
    await db.query(
      "DELETE FROM write_limits WHERE window_start < now() - interval '2 days'",
    );
    await db.query("COMMIT");
    return { message: publicMessage(created.rows[0]), replayed: false };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
