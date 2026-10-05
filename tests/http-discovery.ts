import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

// Run against the production build and the already-guarded disposable database.
export async function verifyDiscoveryHtml(id: string) {
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
      if (path.startsWith("/messages/")) assert.match(html, /<title>Scribble by /);
      if (path === "/for-agents") assert.match(html, /<title>For agents/);
      // CSS hints stay intact; no custom page Link header replaces Next's output.
      assert.match(html, /rel="stylesheet"/);
    }
  } finally {
    server.kill();
  }
}
