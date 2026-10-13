import { config } from "dotenv";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
config({ path: ".env.local", quiet: true });
if (
  process.env.DEVELOPMENT_MODE !== "true" ||
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error(
    "Backup helper only supports this local development database.",
  );
const file = ".local/backups/health-dev.enc";
const dockerEnv = {
  ...process.env,
  DOCKER_CONFIG: process.env.DOCKER_CONFIG || "/workspace/.docker",
};
function run(args, input) {
  const r = spawnSync(
    "docker",
    [
      "compose",
      "--env-file",
      ".env.local",
      "-f",
      "compose.dev.yaml",
      "exec",
      "-T",
      "db",
      ...args,
    ],
    { input, env: dockerEnv, maxBuffer: 64 * 1024 * 1024 },
  );
  if (r.status !== 0)
    throw new Error("Local database backup/restore command failed");
  return r.stdout;
}
function key(create = false) {
  let value = process.env.DEV_BACKUP_KEY;
  if (!value && create) {
    value = randomBytes(32).toString("hex");
    appendFileSync(".env.local", `\nDEV_BACKUP_KEY=${value}\n`);
    process.env.DEV_BACKUP_KEY = value;
  }
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error(
      "The original DEV_BACKUP_KEY is required; never replace the key for an existing backup.",
    );
  return Buffer.from(value, "hex");
}
function decrypted() {
  const value = readFileSync(file);
  if (value.subarray(0, 4).toString() !== "HDB1")
    throw new Error("Invalid backup format");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    value.subarray(4, 16),
  );
  decipher.setAuthTag(value.subarray(16, 32));
  return Buffer.concat([decipher.update(value.subarray(32)), decipher.final()]);
}
function psql(database, statement) {
  return run(["psql", "-U", "health_dev", "-d", database, "-tAc", statement])
    .toString()
    .trim();
}
const action = process.argv[2];
if (action === "backup") {
  const dump = run(["pg_dump", "-U", "health_dev", "-d", "health_dev", "-Fc"]);
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(true), iv),
    encrypted = Buffer.concat([cipher.update(dump), cipher.final()]);
  mkdirSync(".local/backups", { recursive: true, mode: 0o700 });
  writeFileSync(
    file,
    Buffer.concat([Buffer.from("HDB1"), iv, cipher.getAuthTag(), encrypted]),
    { mode: 0o600 },
  );
  console.log("Local database backup encrypted; no data or keys displayed.");
} else if (action === "restore-if-empty") {
  if (!existsSync(file)) {
    console.log("No local snapshot backup; nothing to restore.");
    process.exit(0);
  }
  if (
    psql(
      "health_dev",
      `SELECT count(*) FROM pg_tables WHERE schemaname='public'`,
    ) !== "0"
  ) {
    console.log("Existing database preserved; restore skipped.");
    process.exit(0);
  }
  run(
    [
      "pg_restore",
      "-U",
      "health_dev",
      "-d",
      "health_dev",
      "--no-owner",
      "--exit-on-error",
    ],
    decrypted(),
  );
  console.log(
    "Encrypted local backup restored into an empty development database.",
  );
} else if (action === "verify") {
  const name = "health_restore_" + randomUUID().replaceAll("-", "");
  psql("postgres", `CREATE DATABASE "${name}"`);
  try {
    run(
      [
        "pg_restore",
        "-U",
        "health_dev",
        "-d",
        name,
        "--no-owner",
        "--exit-on-error",
      ],
      decrypted(),
    );
    const migrations = psql(
      name,
      'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
    );
    const users = psql(name, 'SELECT count(*) FROM "User"');
    console.log(
      "Isolated restore verification passed:",
      migrations,
      "migration(s),",
      users,
      "test user(s).",
    );
  } finally {
    psql("postgres", `DROP DATABASE "${name}"`);
  }
} else throw new Error("Expected backup, restore-if-empty, or verify");
