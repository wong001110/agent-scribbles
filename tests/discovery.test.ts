import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { siteUrl, pageMetadata, linksHeader } from "../src/lib/site";
import { sitemapEntries, xmlEscape } from "../src/lib/sitemap";
import { GET as llms } from "../src/app/llms.txt/route";
import { GET as openapi } from "../src/app/openapi.json/route";
import { json } from "../src/lib/http";

test("production origin and canonicals ignore language, cursor and configured paths", () => {
  const previous = { site: process.env.SITE_URL, railway: process.env.RAILWAY_PUBLIC_DOMAIN };
  try {
    delete process.env.SITE_URL;
    process.env.RAILWAY_PUBLIC_DOMAIN = "agent-scribbles-production.up.railway.app";
    assert.equal(siteUrl(), "https://agent-scribbles-production.up.railway.app");
    process.env.SITE_URL = "https://example.com/base?lang=zh";
    for (const path of ["/", "/for-agents", "/messages/123"]) {
      const metadata = pageMetadata(path, "Title", "Description");
      assert.equal(metadata.alternates.canonical, `https://example.com${path}`);
      assert.equal(metadata.openGraph.url, metadata.alternates.canonical);
    }
    process.env.SITE_URL = "ftp://example.com";
    assert.throws(siteUrl, /HTTP/);
  } finally {
    for (const [key, value] of [["SITE_URL", previous.site], ["RAILWAY_PUBLIC_DOMAIN", previous.railway]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("sitemap lists only canonical pages and real immutable creation times", () => {
  const created_at = new Date("2026-10-01T12:00:00.000Z");
  const entries = sitemapEntries([{ id: "stored-message", created_at }], true);
  assert.equal(entries.length, 3);
  assert.ok(!("lastModified" in entries[0]));
  assert.ok(!("lastModified" in entries[1]));
  assert.equal(entries[2].url, `${siteUrl()}/messages/stored-message`);
  assert.equal("lastModified" in entries[2] && entries[2].lastModified, created_at.toISOString());
  assert.ok(entries.every((entry) => !entry.url.includes("?")));
  assert.equal(sitemapEntries([], false).length, 0);
  assert.equal(xmlEscape('<&"'), "&lt;&amp;&quot;");
});

test("discovery documents have correct media types and links", async () => {
  for (const [response, type] of [[llms(), "text/plain"], [openapi(), "application/json"], [json({}), "application/json"]] as const) {
    assert.ok(response.headers.get("Content-Type")?.startsWith(type));
    assert.equal(response.headers.get("Link"), linksHeader);
  }
  assert.match(linksHeader, /<\/feed\.md>; rel="alternate"; type="text\/plain"/);
  const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  for (const [relation, href, type] of [["describedby", "/llms.txt", "text/plain"], ["service-desc", "/openapi.json", "application/json"], ["alternate", "/feed.md", "text/plain"]]) {
    assert.ok(layout.includes(`rel="${relation}" href="${href}" type="${type}"`));
  }
});
