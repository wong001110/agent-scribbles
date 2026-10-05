import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import type { Scribble } from "../src/lib/types";

function htmlEscape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" })[character]!);
}

// Run against the production build and the already-guarded disposable database.
export async function verifyDiscoveryHtml(message: Scribble) {
  const id = message.id;
  const origin = "https://agent-scribbles-production.up.railway.app";
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3098"], {
    env: { ...process.env, SITE_URL: origin },
    stdio: "ignore",
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (server.exitCode !== null) throw new Error("Discovery test server exited");
      try { ready = (await fetch("http://127.0.0.1:3098/llms.txt")).ok; } catch {}
      if (ready) break;
      await setTimeout(250);
    }
    assert.ok(ready, "Discovery test server started");
    for (const path of ["/", "/for-agents", `/messages/${id}`]) {
      const response = await fetch(`http://127.0.0.1:3098${path}?lang=zh&cursor=ignored`);
      assert.equal(response.status, 200);
      const html = await response.text();
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
      assert.ok(canonical);
      const url = new URL(canonical[1]);
      assert.equal(url.origin, origin);
      assert.equal(url.pathname, path);
      assert.equal(url.search, "");
      assert.match(html, /<meta name="description" content="[^"]+"/);
      for (const [relation, href, type] of [["describedby", "/llms.txt", "text/plain"], ["service-desc", "/openapi.json", "application/json"], ["alternate", "/feed.md", "text/plain"]]) {
        assert.ok(html.includes(`rel="${relation}" href="${href}" type="${type}"`));
      }
      if (path.startsWith("/messages/")) {
        assert.ok(html.includes(`<title>Scribble by ${htmlEscape(message.name)}`));
        const summary = `Public scribble by ${message.name}: ${message.message}`;
        assert.ok(html.includes(`<meta name="description" content="${htmlEscape(summary)}"`));
        assert.ok(!html.includes('<script>alert("x&y")</script>'));
      }
      if (path === "/for-agents") assert.match(html, /<title>For agents/);
      // CSS hints stay intact; no custom page Link header replaces Next's output.
      assert.match(html, /rel="stylesheet"/);
    }
    const index = await fetch("http://127.0.0.1:3098/sitemap.xml");
    assert.equal(index.status, 200);
    const indexXml = await index.text();
    assert.ok(indexXml.includes(`${origin}/sitemap-0.xml</loc>`));
    const shard = await fetch("http://127.0.0.1:3098/sitemap-0.xml");
    assert.equal(shard.status, 200);
    assert.match(shard.headers.get("Content-Type")!, /application\/xml/);
    assert.ok((await shard.text()).includes(`${origin}/messages/${id}</loc>`));
    for (const path of ["/sitemap-01.xml", "/sitemap-no.xml", "/unknown-page", "/sitemaps/0"]) {
      assert.equal((await fetch(`http://127.0.0.1:3098${path}`)).status, 404);
    }
  } finally {
    server.kill();
  }
}
