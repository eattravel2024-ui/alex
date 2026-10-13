// Operator-only bootstrap for the isolated demo site, never a public signup route.
import { config } from "dotenv";
import { constants, openSync, closeSync, fstatSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
config({ path: ".env.local", quiet: true });
class Refusal extends Error {}
function refuse(message) { throw new Refusal(message); }
let pool, client;
try {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--confirm-demo-bootstrap") {
      if (options.confirm) refuse("Duplicate confirmation flag.");
      options.confirm = true;
    } else if (["--email", "--name", "--password-file"].includes(key) && args[i + 1] && !args[i + 1].startsWith("--")) {
      if (options[key]) refuse("Duplicate option.");
      options[key] = args[++i];
    } else refuse("Usage: --email <demo@example.test> --name <display name> --password-file <private file> --confirm-demo-bootstrap");
  }
  if (!options.confirm) refuse("Explicit --confirm-demo-bootstrap is required.");
  const email = options["--email"]?.trim().toLowerCase();
  const name = options["--name"]?.trim();
  if (!email || email.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@example\.test$/.test(email))
    refuse("Only a reserved @example.test demo login identifier is allowed.");
  if (!name || name.length < 2 || name.length > 60) refuse("Display name must be 2–60 characters.");
  const url = new URL(process.env.DATABASE_URL ?? "");
  const origin = new URL(process.env.BETTER_AUTH_URL ?? "");
  const localTest = process.env.DEVELOPMENT_MODE === "true" && ["localhost", "127.0.0.1"].includes(url.hostname)
    && /^\/health_admin_check_[a-f0-9]{32}$/.test(url.pathname);
  const demoVps = process.env.DEVELOPMENT_MODE === "false" && url.pathname === "/cchm_demo"
    && origin.protocol === "https:" && origin.hostname === "test.cchm.tw"
    && origin.pathname === "/" && !origin.username && !origin.password && !origin.search && !origin.hash;
  if (!localTest && !demoVps) refuse("Only the isolated cchm_demo site at https://test.cchm.tw or a dedicated local test DB is supported.");
  const file = options["--password-file"];
  if (!file) refuse("A private password file is required; passwords are never accepted as command arguments.");
  let password;
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid() || stat.size > 256)
      refuse("Password file must be a regular owner-only file owned by the current user.");
    password = readFileSync(fd, "utf8").replace(/\r?\n$/, "");
  } finally { closeSync(fd); }
  if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    refuse("Password must be 8–128 characters, including letters and digits.");
  const hashed = await hashPassword(password);
  password = undefined;
  pool = new pg.Pool({ connectionString: url.toString() });
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('cchm-demo-admin-bootstrap',0))");
  const admins = await client.query("SELECT id FROM \"User\" WHERE role IN ('SUPER_ADMIN','ADMIN','EDITOR','STAFF') LIMIT 1");
  if (admins.rows.length) refuse("A management account already exists. No account or password was changed.");
  if ((await client.query('SELECT id FROM "User" WHERE email=$1', [email])).rows.length)
    refuse("Login identifier already exists. No existing account was promoted or overwritten.");
  const id = randomUUID();
  // emailVerified=true is an explicit operator assertion for this reserved demo identifier,
  // not evidence of email delivery or mailbox ownership. Public signup remains closed.
  await client.query('INSERT INTO "User" (id,name,email,"emailVerified",role,disabled,"updatedAt") VALUES ($1,$2,$3,true,\'SUPER_ADMIN\',false,now())', [id, name, email]);
  await client.query('INSERT INTO "Account" (id,"accountId","providerId","userId",password,"updatedAt") VALUES ($1,$2,\'credential\',$3,$4,now())', [randomUUID(), id, id, hashed]);
  await client.query('INSERT INTO "AuditLog" (id,"actorId",action,"entityId") VALUES ($1,$2,\'DEMO_ADMIN_BOOTSTRAPPED\',$3)', [randomUUID(), id, id]);
  await client.query("COMMIT");
  console.log("Demo administrator created; credential hash and audit record committed. No email sent; no public signup or policy flags changed.");
} catch (error) {
  if (client) await client.query("ROLLBACK").catch(() => {});
  console.error(error instanceof Refusal ? error.message : "Bootstrap failed. Check runtime configuration, database access and password-file permissions; no secrets displayed.");
  process.exitCode = 1;
} finally {
  client?.release();
  await pool?.end();
}
