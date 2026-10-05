import { pool } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { sitemapPageSize, xmlEscape } from "@/lib/sitemap";
import { failure } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const result = await pool().query("SELECT count(*)::int AS total FROM scribbles");
    const pages = Math.max(1, Math.ceil(result.rows[0].total / sitemapPageSize));
    const entries = Array.from({ length: pages }, (_, page) => `<sitemap><loc>${xmlEscape(`${siteUrl()}/sitemaps/${page}`)}</loc></sitemap>`).join("");
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
