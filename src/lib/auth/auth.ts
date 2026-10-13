import "server-only";
import { after } from "next/server";
import { allowAccountAttempt } from "@/lib/server/auth-throttle";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { db } from "@/lib/server/db";
import { sendAuthEmail } from "@/lib/server/email";
import { passwordSchema, registrationSchema } from "@/lib/validation";
function queueEmail(to: string, subject: string, url: string) {
  after(async () => {
    try {
      await sendAuthEmail(to, subject, url);
    } catch (error) {
      console.error(
        "Auth mail delivery failed:",
        error instanceof Error ? error.name : "Unknown",
      );
    }
  });
}
let instance: ReturnType<typeof makeAuth> | undefined;
function makeAuth() {
  const baseURL = process.env.BETTER_AUTH_URL,
    secret = process.env.BETTER_AUTH_SECRET;
  if (!baseURL || !secret || secret.length < 32)
    throw new Error("Auth runtime configuration is missing");
  const origin = new URL(baseURL).origin;
  if (
    process.env.DEVELOPMENT_MODE === "true" &&
    !["127.0.0.1", "localhost"].includes(new URL(origin).hostname)
  )
    throw new Error("Development authentication must use a loopback origin.");
  if (
    new URL(origin).protocol !== "https:" &&
    !(
      process.env.DEVELOPMENT_MODE === "true" &&
      ["127.0.0.1", "localhost"].includes(new URL(origin).hostname)
    )
  )
    throw new Error("Auth requires HTTPS outside local development");
  return betterAuth({
    appName: "中華健康管理協會（開發版）",
    baseURL: origin,
    secret,
    database: prismaAdapter(db, { provider: "postgresql", transaction: true }),
    trustedOrigins: [origin],
    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: origin.startsWith("https:"),
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    verification: { storeIdentifier: "hashed" },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 1800,
      sendResetPassword: async ({ user, url }) =>
        queueEmail(user.email, "重設密碼", url),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) =>
        queueEmail(user.email, "驗證電子郵件", url),
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "MEMBER",
          input: false,
          returned: false,
        },
        disabled: {
          type: "boolean",
          defaultValue: false,
          input: false,
          returned: false,
        },
        termsAccepted: { type: "boolean", required: true },
        privacyAccepted: { type: "boolean", required: true },
        termsAcceptedAt: {
          type: "date",
          input: false,
          returned: false,
          required: false,
        },
        privacyAcceptedAt: {
          type: "date",
          input: false,
          returned: false,
          required: false,
        },
        policyVersion: {
          type: "string",
          input: false,
          returned: false,
          required: false,
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 600, max: 10 },
        "/sign-up/email": { window: 600, max: 5 },
        "/request-password-reset": { window: 600, max: 5 },
        "/send-verification-email": { window: 600, max: 5 },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (
          [
            "/sign-in/email",
            "/request-password-reset",
            "/send-verification-email",
          ].includes(ctx.path) &&
          typeof ctx.body?.email === "string"
        ) {
          if (
            !(await allowAccountAttempt(
              ctx.path,
              ctx.body.email,
              ctx.path === "/sign-in/email" ? 10 : 5,
            ))
          )
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "請稍後重試。",
            });
        }
        if (ctx.path === "/sign-up/email") {
          if (
            process.env.DEVELOPMENT_MODE !== "true" &&
            process.env.POLICIES_APPROVED !== "true"
          )
            throw new APIError("FORBIDDEN", { message: "註冊尚未開放。" });
          const result = registrationSchema.safeParse(ctx.body);
          if (!result.success)
            throw new APIError("BAD_REQUEST", {
              message: result.error.issues[0].message,
            });
          Object.assign(ctx.body, result.data);
        }
        if (ctx.path === "/reset-password" || ctx.path === "/change-password") {
          const result = passwordSchema.safeParse(ctx.body?.newPassword);
          if (!result.success)
            throw new APIError("BAD_REQUEST", {
              message: "新密碼至少 12 字元，且需包含字母與數字。",
            });
        }
        if (ctx.path === "/update-user")
          throw new APIError("FORBIDDEN", {
            message: "請使用會員資料介面更新。",
          });
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              termsAcceptedAt: new Date(),
              privacyAcceptedAt: new Date(),
              policyVersion:
                process.env.DEVELOPMENT_MODE === "true"
                  ? "development-2026-10-13"
                  : process.env.POLICY_VERSION,
            },
          }),
        },
      },
      session: {
        create: {
          before: async (session) => {
            const user = await db.user.findUnique({
              where: { id: session.userId },
              select: { disabled: true },
            });
            if (user?.disabled)
              throw new APIError("FORBIDDEN", {
                message: "帳號目前無法登入。",
              });
            return { data: { ...session, ipAddress: null, userAgent: null } };
          },
        },
      },
    },
  });
}
export function getAuth() {
  return (instance ??= makeAuth());
}
