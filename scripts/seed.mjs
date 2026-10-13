import { config } from "dotenv";
import pg from "pg";
import { randomUUID } from "node:crypto";
config({ path: ".env.local", quiet: true });
if (
  process.env.DEVELOPMENT_MODE !== "true" ||
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error(
    "Seed is only allowed on explicitly configured local development databases.",
  );
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const [code, name] of [
    ["DEMO_PERSONAL", "示範個人會員"],
    ["DEMO_GROUP", "示範團體會員"],
  ])
    await pool.query(
      'INSERT INTO "MembershipType" (id,code,name,description,active,"isDemo") VALUES ($1,$2,$3,$4,true,true) ON CONFLICT (code) DO NOTHING',
      [randomUUID(), code, name, "僅供開發測試，不代表協會正式入會規則。"],
    );
  console.log(
    "Demo membership types seeded; no user/admin accounts or default passwords created.",
  );
} finally {
  await pool.end();
}
