import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  pool,
  readWall,
  readMessage,
  writeMessage,
  clientHash,
} from "../src/lib/db";
import { GET as sitemapIndex } from "../src/app/sitemap.xml/route";
import { GET as sitemapPage } from "../src/app/sitemaps/[page]/route";
import { GET as feed } from "../src/app/feed.md/route";
import { verifyDiscoveryHtml } from "./http-discovery";
import { testDatabaseUrl } from "../scripts/test-database";
import { WallError, validateMessage } from "../src/lib/validation";

test("untrusted forwarding headers cannot choose a limit bucket", () => {
  const previous = {
    secret: process.env.RATE_LIMIT_SECRET,
    proxy: process.env.TRUST_PROXY,
  };
  try {
    process.env.RATE_LIMIT_SECRET = "test-secret-".repeat(5);
    process.env.TRUST_PROXY = "false";
    assert.equal(
      clientHash(new Headers({ "x-real-ip": "1.2.3.4" })),
      clientHash(new Headers({ "x-real-ip": "9.8.7.6" })),
    );
    process.env.TRUST_PROXY = "true";
    assert.notEqual(
      clientHash(new Headers({ "x-real-ip": "1.2.3.4" })),
      clientHash(new Headers({ "x-real-ip": "9.8.7.6" })),
    );
    assert.equal(
      clientHash(new Headers({ "x-forwarded-for": "1.2.3.4" })),
      clientHash(new Headers()),
    );
  } finally {
    if (previous.secret === undefined) delete process.env.RATE_LIMIT_SECRET;
    else process.env.RATE_LIMIT_SECRET = previous.secret;
    if (previous.proxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous.proxy;
  }
});

test(
  "PostgreSQL concurrent retries, limits, persistence and pagination",
  { skip: process.env.RUN_DB_TESTS !== "true" },
  async () => {
    process.env.DATABASE_URL = testDatabaseUrl(process.env.TEST_DATABASE_URL);
    const marker = randomUUID();
    const source = randomUUID();
    try {
      const body = {
        name: marker,
        message: "Hello 世界 👋 <script>alert(1)</script>",
      };
      const key = randomUUID();
      validateMessage(body); // Keep fixtures inside the API/schema boundaries.
      const retries = await Promise.all(
        Array.from({ length: 8 }, () => writeMessage(body, source, key)),
      );
      assert.equal(new Set(retries.map((r) => r.message.id)).size, 1);
      assert.equal(retries.filter((r) => !r.replayed).length, 1);
      assert.equal(
        (await readMessage(retries[0].message.id))?.message,
        body.message,
      );
      await assert.rejects(
        writeMessage({ ...body, message: "changed" }, source, key),
        (e: unknown) => e instanceof WallError && e.status === 409,
      );
      const second = await writeMessage(
        { name: marker, message: "Second" },
        source,
        randomUUID(),
      );
      const third = await writeMessage(
        { name: marker, message: "Third" },
        source,
        randomUUID(),
      );
      await assert.rejects(
        writeMessage(
          { name: marker, message: "Over limit" },
          source,
          randomUUID(),
        ),
        (e: unknown) =>
          e instanceof WallError && e.status === 429 && (e.retryAfter || 0) > 0,
      );
      assert.equal(
        (await writeMessage(body, source, key)).replayed,
        true,
        "Replays remain possible after the write limit",
      );
      const firstPage = await readWall(undefined, 1);
      assert.equal(firstPage.messages[0].id, third.message.id);
      const nextPage = await readWall(firstPage.next_cursor!, 1);
      assert.equal(nextPage.messages[0].id, second.message.id);
      assert.ok(
        !("ip_hash" in nextPage.messages[0]),
        "Public messages exclude internal hashes",
      );
      assert.equal(await readMessage(randomUUID()), null);
      const indexResponse = await sitemapIndex();
      assert.equal(indexResponse.status, 200);
      assert.match(indexResponse.headers.get("Content-Type")!, /application\/xml/);
      assert.match(await indexResponse.text(), /\/sitemaps\/0<\/loc>/);
      const sitemap = await sitemapPage(new Request("http://localhost/sitemaps/0"), { params: Promise.resolve({ page: "0" }) });
      const xml = await sitemap.text();
      assert.ok(xml.includes(`/messages/${third.message.id}</loc><lastmod>${third.message.created_at}</lastmod>`));
      assert.ok(!xml.includes("?lang="));
      assert.equal((await sitemapPage(new Request("http://localhost"), { params: Promise.resolve({ page: "9999" }) })).status, 404);
      const textFeed = await feed();
      assert.match(textFeed.headers.get("Content-Type")!, /text\/plain/);
      assert.match(textFeed.headers.get("Link")!, /rel="alternate"/);
      assert.ok((await textFeed.text()).includes(third.message.id));
      await verifyDiscoveryHtml(third.message.id);

    } finally {
      await pool().query("DELETE FROM scribbles WHERE name=$1", [marker]);
      await pool().query("DELETE FROM write_limits WHERE bucket_key=$1", [
        source,
      ]);
      await pool().end();
    }
  },
);
