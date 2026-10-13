// Explicit local bootstrap; no account, email, password, or default credentials are created.
import { config } from "dotenv";
import pg from "pg";
config({ path: ".env.local", quiet: true });
const url = process.env.DATABASE_URL;
if (
  process.env.DEVELOPMENT_MODE !== "true" ||
  !url ||
  !["127.0.0.1", "localhost"].includes(new URL(url).hostname)
)
  throw new Error("Admin bootstrap is restricted to local development.");
const address = process.argv[2]?.trim().toLowerCase();
if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
  throw new Error(
    "Usage: npm run dev:admin -- <existing verified development account email>",
  );
const pool = new pg.Pool({ connectionString: url });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const { rows } = await client.query(
    'SELECT id, role, disabled, "emailVerified" FROM "User" WHERE email=$1 FOR UPDATE',
    [address],
  );
  const user = rows[0];
  if (!user || !user.emailVerified || user.disabled)
    throw new Error(
      "An enabled, verified local account is required. No changes applied.",
    );
  if (user.role === "SUPER_ADMIN")
    console.log("Development administrator already configured.");
  else {
    if (user.role !== "MEMBER")
      throw new Error("Refusing to replace an existing management role.");
    await client.query(
      'UPDATE "User" SET role=\'SUPER_ADMIN\', "updatedAt"=now() WHERE id=$1',
      [user.id],
    );
    await client.query(
      'INSERT INTO "AuditLog" (id, "actorId", action, "entityId", "createdAt") VALUES (gen_random_uuid(), $1, \'DEV_ADMIN_BOOTSTRAPPED\', $2, now())',
      [user.id, user.id],
    );
    console.log(
      "Existing development account promoted; audit record written. No credentials created.",
    );
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
