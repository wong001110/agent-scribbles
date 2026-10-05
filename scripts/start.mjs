import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { migrate } from "./migrate.mjs";

if (!process.env.RATE_LIMIT_SECRET || process.env.RATE_LIMIT_SECRET.length < 32)
  throw new Error("RATE_LIMIT_SECRET must contain at least 32 characters.");
await migrate();
const standalone = existsSync("server.js");
const args = standalone
  ? ["server.js"]
  : [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "0.0.0.0",
      "--port",
      process.env.PORT || "3000",
    ];
const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
