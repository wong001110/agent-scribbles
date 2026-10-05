import { pool } from "@/lib/db";
import { sitemapEntries, sitemapPageSize, xmlEscape } from "@/lib/sitemap";
import { failure } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  if (!/^(0|[1-9]\d*)$/.test(page) || !Number.isSafeInteger(Number(page)) || Number(page) > Math.floor(Number.MAX_SAFE_INTEGER / sitemapPageSize)) return new Response(null, { status: 404 });
  try {
    const result = await pool().query("SELECT id,created_at FROM scribbles ORDER BY created_at ASC,id ASC LIMIT $1 OFFSET $2", [sitemapPageSize, Number(page) * sitemapPageSize]);
    if (page !== "0" && !result.rowCount) return new Response(null, { status: 404 });
    const entries = sitemapEntries(result.rows, page === "0").map((entry) => `<url><loc>${xmlEscape(entry.url)}</loc>${"lastModified" in entry ? `<lastmod>${entry.lastModified}</lastmod>` : ""}</url>`).join("");
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
