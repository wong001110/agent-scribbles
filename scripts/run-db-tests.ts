import { spawnSync } from "node:child_process";
import { testDatabaseUrl } from "./test-database";

const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", "tests/database.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: databaseUrl, RUN_DB_TESTS: "true" },
});
if (result.error) throw new Error("Could not start database tests.");
process.exitCode = result.status ?? 1;
