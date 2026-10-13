import { expect, type APIRequestContext } from "@playwright/test";
import { config } from "dotenv";
import pg from "pg";
import { randomBytes, randomUUID } from "node:crypto";
config({ path: ".env.local", quiet: true });
const origin = "http://127.0.0.1:3000";
export function password() {
  return "T-" + randomBytes(18).toString("hex") + "-9";
}
export function email() {
  return "phase3-" + randomUUID() + "@example.test";
}
function pool() {
  if (
    process.env.DEVELOPMENT_MODE !== "true" ||
    !["127.0.0.1", "localhost"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error("Tests require a local development database");
  return new pg.Pool({ connectionString: process.env.DATABASE_URL });
}
export async function sql(query: string, values: unknown[] = []) {
  const db = pool();
  try {
    return (await db.query(query, values)).rows;
  } finally {
    await db.end();
  }
}
const addresses = new WeakMap<APIRequestContext, string>();
export function clientAddress(api: APIRequestContext) {
  if (!addresses.has(api)) {
    const bytes = randomBytes(2);
    addresses.set(api, `198.18.${bytes[0]}.${bytes[1]}`);
  }
  return addresses.get(api)!;
}
export async function post(
  api: APIRequestContext,
  path: string,
  data: unknown,
) {
  return api.post(path, {
    data,
    headers: { origin, "x-forwarded-for": clientAddress(api) },
  });
}
export async function mailLink(
  api: APIRequestContext,
  to: string,
  subject: string,
) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = await api.get(
      "http://127.0.0.1:8025/api/v1/search?query=" +
        encodeURIComponent("to:" + to),
    );
    const messages = (await result.json()).messages ?? [];
    const found = messages.find(
      (m: { Subject: string }) => m.Subject === subject,
    );
    if (found) {
      const detail = await (
        await api.get("http://127.0.0.1:8025/api/v1/message/" + found.ID)
      ).json();
      const link = String(detail.Text).match(/https?:\/\/[^\s]+/);
      if (link) return link[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local test email was not delivered");
}
export async function createVerified(
  api: APIRequestContext,
  address = email(),
) {
  const secret = password();
  const response = await post(api, "/api/auth/sign-up/email", {
    name: "開發測試帳號",
    email: address,
    password: secret,
    termsAccepted: true,
    privacyAccepted: true,
    callbackURL: "/auth/verify",
    role: "SUPER_ADMIN",
  });
  expect(response.status()).toBe(200);
  const link = await mailLink(api, address, "驗證電子郵件");
  await api.get(link);
  const responseLogin = await post(api, "/api/auth/sign-in/email", {
    email: address,
    password: secret,
  });
  expect(responseLogin.status()).toBe(200);
  const me = await (await api.get("/api/me")).json();
  return { address, secret, id: me.id };
}
