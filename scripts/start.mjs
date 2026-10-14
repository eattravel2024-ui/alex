import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
if (!existsSync(".next/standalone/server.js")) {
  console.error("請先執行 npm run build");
  process.exit(1);
}
cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
    PORT: process.env.PORT || "3000",
    ...(process.env.DEVELOPMENT_MODE === "true" && !process.env.MEDIA_STORAGE_DIR
      ? { MEDIA_STORAGE_DIR: resolve(".local/media") }
      : {}),
  },
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 1));
