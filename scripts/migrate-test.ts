import { spawnSync } from "node:child_process";
import { testDatabaseUrl } from "./test-database";

// Validate before spawning the migrator or opening any database connection.
const databaseUrl = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const result = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});
if (result.error) throw new Error("Could not start the test database migrator.");
process.exitCode = result.status ?? 1;
