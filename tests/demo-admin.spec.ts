import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { sql } from "./auth-helpers";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import pg from "pg";
import { verifyPassword } from "better-auth/crypto";

test("示範管理員首次初始化、拒絕覆寫與安全限制，真實登入後台且不用SMTP", async ({ request }) => {
  const name = "health_admin_check_" + randomUUID().replaceAll("-", "");
  const url = new URL(process.env.DATABASE_URL!); url.pathname = "/" + name;
  const folder = mkdtempSync(".local/admin-check-");
  const file = folder + "/password";
  const secret = "A" + randomUUID().slice(0, 6) + "9";
  writeFileSync(file, secret + "\n", { mode: 0o600 });
  const email = "demo-admin@example.test";
  const args = ["scripts/demo-admin.mjs", "--email", email, "--name", "示範管理員", "--password-file", file, "--confirm-demo-bootstrap"];
  const env: NodeJS.ProcessEnv = { ...process.env, DEVELOPMENT_MODE: "true", DATABASE_URL: url.toString() };
  const run = (values = args, vars = env) => spawnSync(process.execPath, values, { env: vars, encoding: "utf8", timeout: 60000 });
  let created = false;
  let db: pg.Pool | undefined, child: ReturnType<typeof spawn> | undefined;
  try {
    await sql(`CREATE DATABASE "${name}"`); created = true;
    const migration = run(["--experimental-wasm-modules", "scripts/prisma-migrate-wasm.mjs"]);
    expect(migration.status).toBe(0);
    expect(run(args.slice(0, -1)).status).toBe(1);
    expect(run(args.map((v) => v === email ? "real@example.com" : v)).status).toBe(1);
    expect(run(args, { ...env, DEVELOPMENT_MODE: "false", BETTER_AUTH_URL: "http://test.cchm.tw" }).status).toBe(1);
    chmodSync(file, 0o644);
    expect(run().status).toBe(1);
    chmodSync(file, 0o600);
    db = new pg.Pool({ connectionString: url.toString() });
    const existing = randomUUID();
    await db.query('INSERT INTO "User" (id,name,email,"updatedAt") VALUES ($1,$2,$3,now())', [existing, "既有一般帳號", email]);
    expect(run().status).toBe(1);
    expect((await db.query('SELECT role FROM "User" WHERE id=$1', [existing])).rows[0].role).toBe("MEMBER");
    await db.query('DELETE FROM "User" WHERE id=$1', [existing]);
    const first = run();
    expect(first.status).toBe(0);
    expect(first.stdout).toContain("Demo administrator created");
    expect(first.stdout + first.stderr).not.toContain(secret);
    const users = (await db.query('SELECT id,role,"emailVerified","termsAccepted" FROM "User"')).rows;
    expect(users).toHaveLength(1);
    expect(users[0].role).toBe("SUPER_ADMIN");
    expect(users[0].emailVerified).toBe(true);
    expect(users[0].termsAccepted).toBe(false);
    const credential = (await db.query('SELECT password,"providerId" FROM "Account"')).rows[0];
    expect(credential.providerId).toBe("credential");
    expect(await verifyPassword({ password: secret, hash: credential.password })).toBe(true);
    expect(run().status).toBe(1);
    expect((await db.query('SELECT id FROM "AuditLog" WHERE action=\'DEMO_ADMIN_BOOTSTRAPPED\'')).rows).toHaveLength(1);
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const origin = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ["scripts/start.mjs"], {
      env: { ...env, HOSTNAME: "127.0.0.1", PORT: String(port), BETTER_AUTH_URL: origin, POLICIES_APPROVED: "false", SMTP_HOST: "", CONTACT_SUBMISSIONS_ENABLED: "false" }, stdio: "ignore",
    });
    await expect.poll(async () => {
      try { return (await request.get(origin + "/auth/login")).status(); } catch { return 0; }
    }, { timeout: 15000 }).toBe(200);
    const login = await request.post(origin + "/api/auth/sign-in/email", { headers: { origin }, data: { email, password: secret } });
    expect(login.status()).toBe(200);
    const dashboard = await request.get(origin + "/admin");
    expect(dashboard.status()).toBe(200);
    expect(await dashboard.text()).toContain("工作總覽");
    const replacement = "B" + randomUUID().slice(0, 6) + "8";
    writeFileSync(file, replacement + "\n", { mode: 0o600 });
    const nextEmail = "admin@cchm.tw";
    const resetArgs = [...args.map((v) => v === email ? nextEmail : v), "--reset-demo-password", "--previous-email", email];
    const reset = run(resetArgs);
    expect(reset.status).toBe(0);
    expect(reset.stdout).toContain("all sessions revoked");
    expect(reset.stdout + reset.stderr).not.toContain(replacement);
    expect((await db.query('SELECT id FROM "Session"')).rows).toHaveLength(0);
    const revoked = await request.get(origin + "/admin", { maxRedirects: 0 });
    expect(await revoked.text()).not.toContain("工作總覽");
    expect((await request.get(origin + "/api/me")).status()).toBe(401);
    expect((await request.post(origin + "/api/auth/sign-in/email", { headers: { origin }, data: { email, password: secret } })).status()).toBe(401);
    expect((await request.post(origin + "/api/auth/sign-in/email", { headers: { origin }, data: { email, password: replacement } })).status()).toBe(401);
    expect((await request.post(origin + "/api/auth/sign-in/email", { headers: { origin }, data: { email: nextEmail, password: replacement } })).status()).toBe(200);
    expect((await db.query('SELECT id FROM "User" WHERE email=$1', [nextEmail])).rows[0].id).toBe(users[0].id);
    expect((await db.query('SELECT id FROM "AuditLog" WHERE action=\'DEMO_ADMIN_LOGIN_RENAMED\'')).rows).toHaveLength(1);
    expect((await db.query('SELECT id FROM "AuditLog" WHERE action=\'DEMO_ADMIN_PASSWORD_RESET\'')).rows).toHaveLength(1);
    await db.query('UPDATE "User" SET disabled=true');
    expect(run([...args.map((v) => v === email ? nextEmail : v), "--reset-demo-password"]).status).toBe(1);
  } finally {
    if (child && child.exitCode === null) {
      const stopped = new Promise<void>((resolve) => child!.once("exit", () => resolve()));
      child.kill("SIGTERM"); await stopped;
    }
    await db?.end();
    if (created) await sql(`DROP DATABASE "${name}" WITH (FORCE)`);
    rmSync(folder, { recursive: true, force: true });
  }
});
