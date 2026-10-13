// Creates/drops only this invocation's randomly named, isolated local test DB.
import { config } from "dotenv";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
config({ path: ".env.local", quiet: true });
const url = process.env.DATABASE_URL;
if (
  process.env.DEVELOPMENT_MODE !== "true" ||
  !url ||
  !["127.0.0.1", "localhost"].includes(new URL(url).hostname)
)
  throw new Error("Schema verification requires local development.");
const name = "health_cms_check_" + randomUUID().replaceAll("-", "");
const admin = new pg.Pool({ connectionString: url });
let created = false,
  isolated;
function run(args, connection) {
  const result = spawnSync(process.execPath, args, {
    env: { ...process.env, DATABASE_URL: connection },
    encoding: "utf8",
    timeout: 60000,
  });
  if (result.status !== 0)
    throw new Error("Isolated schema command failed: " + args.at(-1));
  return result.stdout;
}
try {
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  const connection = new URL(url);
  connection.pathname = "/" + name;
  const localUrl = connection.toString();
  run(
    ["--experimental-wasm-modules", "scripts/prisma-migrate-wasm.mjs"],
    localUrl,
  );
  const rerun = run(
    ["--experimental-wasm-modules", "scripts/prisma-migrate-wasm.mjs"],
    localUrl,
  );
  if (!rerun.includes("Applied migrations: 0"))
    throw new Error("Migration repeatability failed.");
  run(["scripts/seed.mjs"], localUrl);
  isolated = new pg.Pool({ connectionString: localUrl });
  const migrations = await isolated.query(
    'SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
  );
  const users = await isolated.query(
    'SELECT count(*)::int AS count FROM "User"',
  );
  const articles = await isolated.query(
    'SELECT count(*)::int AS count FROM "ArticleRecord"',
  );
  if (
    migrations.rows[0].count !== 3 ||
    users.rows[0].count !== 0 ||
    articles.rows[0].count !== 9
  )
    throw new Error("Fresh schema/seed counts mismatch.");
  const events = await isolated.query(
    'SELECT count(*)::int AS count FROM "EventRecord"',
  );
  if (events.rows[0].count !== 3) throw new Error("Event seed count mismatch.");
  await isolated.query(
    "UPDATE \"EventRecord\" SET title=$1,status='ARCHIVED' WHERE slug='everyday-health-talk'",
    ["保留活動修改"],
  );
  await isolated.query(
    "UPDATE \"ArticleRecord\" SET title=$1,status='ARCHIVED',\"publishAt\"=NULL WHERE slug='everyday-health'",
    ["保留 CMS 修改驗證"],
  );
  run(["scripts/seed.mjs"], localUrl);
  const preserved = await isolated.query(
    "SELECT title,status FROM \"ArticleRecord\" WHERE slug='everyday-health'",
  );
  if (
    preserved.rows[0].title !== "保留 CMS 修改驗證" ||
    preserved.rows[0].status !== "ARCHIVED"
  )
    throw new Error("Seed overwrote CMS content.");
  const keptEvent = await isolated.query(
    "SELECT title,status FROM \"EventRecord\" WHERE slug='everyday-health-talk'",
  );
  if (
    keptEvent.rows[0].title !== "保留活動修改" ||
    keptEvent.rows[0].status !== "ARCHIVED"
  )
    throw new Error("Seed overwrote event changes.");
  const checks = await isolated.query(
    "SELECT count(*)::int AS count FROM pg_constraint WHERE conname IN ('membership_valid_period','application_positive_version','article_positive_version','article_publication_time','event_valid_period','event_valid_deadline','event_valid_capacity','event_positive_version','event_checkin_pair')",
  );
  const partial = await isolated.query(
    "SELECT indexname FROM pg_indexes WHERE indexname='application_one_open_per_user'",
  );
  if (checks.rows[0].count !== 9 || partial.rows.length !== 1)
    throw new Error("Business constraints missing.");
  console.log(
    "Isolated CMS schema verified: 3 migrations, 9 demo articles, 3 demo events, no default users; seed preserves edits and archive state, member constraints retained.",
  );
} finally {
  if (isolated) await isolated.end();
  if (created) await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
}
