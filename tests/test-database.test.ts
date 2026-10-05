import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { testDatabaseUrl } from "../scripts/test-database";

test("test database guard refuses application and remote databases without exposing URLs", () => {
  for (const value of [undefined, "invalid", "postgres://user:private@localhost/scribbles",
    "postgres://user:private@production.example/agent_scribbles_test",
    "https://localhost/agent_scribbles_test",
    "postgres://localhost/agent_scribbles_test?host=production.example",
    "postgres://localhost/agent_scribbles_test#fragment",
    "postgres://localhost/agent_scribbles_test%2fother"]) {
    assert.throws(() => testDatabaseUrl(value), (error: unknown) =>
      error instanceof Error && error.message.includes("disposable localhost") &&
      !error.message.includes("private") && !error.message.includes("production.example"));
  }
});

test("test database guard accepts explicit loopback disposable database URLs", () => {
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    const value = `postgresql://postgres:test@${host}:5432/agent_scribbles_test`;
    assert.equal(testDatabaseUrl(value), value);
  }
});

test("migration and integration entry points refuse DATABASE_URL fallback", () => {
  for (const script of ["scripts/migrate-test.ts", "scripts/run-db-tests.ts"]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", script], {
      encoding: "utf8",
      env: { ...process.env, TEST_DATABASE_URL: "", DATABASE_URL: "postgres://user:private@production.example/app" },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /disposable localhost/);
    assert.doesNotMatch(result.stderr, /private|production\.example|ENOTFOUND/);
  }
});
