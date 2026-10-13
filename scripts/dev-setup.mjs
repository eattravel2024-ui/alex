import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
if (!existsSync(".env.local")) {
  const password = randomBytes(24).toString("hex");
  writeFileSync(
    ".env.local",
    `# LOCAL DEVELOPMENT ONLY. Never commit or use these settings in production.\nDEV_DATABASE_PASSWORD=${password}\nDATABASE_URL=postgresql://health_dev:${password}@127.0.0.1:5433/health_dev\nBETTER_AUTH_SECRET=${randomBytes(48).toString("hex")}\nBETTER_AUTH_URL=http://127.0.0.1:3000\nSMTP_HOST=127.0.0.1\nSMTP_PORT=1025\nSMTP_SECURE=false\nSMTP_FROM=health-dev@example.test\nMEMBERSHIP_APPLICATIONS_ENABLED=true\nDEVELOPMENT_MODE=true\nSITE_INDEXING_ENABLED=false\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Generated ignored local development configuration; secret values are not displayed.",
  );
} else console.log("Preserving existing .env.local; no values overwritten.");
const result = spawnSync(
  "docker",
  [
    "compose",
    "--env-file",
    ".env.local",
    "-f",
    "compose.dev.yaml",
    "up",
    "-d",
    "--wait",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DOCKER_CONFIG: process.env.DOCKER_CONFIG || "/workspace/.docker",
    },
  },
);
process.exit(result.status ?? 1);
