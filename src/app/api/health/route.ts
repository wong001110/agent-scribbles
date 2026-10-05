import { pool } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try { await pool().query("SELECT 1 FROM scribbles LIMIT 1"); return Response.json({ status: "ok", storage: "postgresql" }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
