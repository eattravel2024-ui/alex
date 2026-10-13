import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/server/db";
export async function allowAccountAttempt(
  action: string,
  email: string,
  max: number,
) {
  const key =
    "account:" +
    action +
    ":" +
    createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  const now = BigInt(Date.now()),
    cutoff = now - BigInt(600000);
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" (id,key,count,"lastRequest") VALUES (${randomUUID()}::uuid,${key},1,${now}) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN "RateLimit"."lastRequest" < ${cutoff} THEN 1 ELSE "RateLimit".count + 1 END, "lastRequest" = CASE WHEN "RateLimit"."lastRequest" < ${cutoff} THEN ${now} ELSE "RateLimit"."lastRequest" END RETURNING count`;
  return rows[0].count <= max;
}
