import "server-only";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth/auth";
import { db } from "@/lib/server/db";
export class ServiceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function currentUser(requestHeaders?: Headers) {
  const resolvedHeaders = requestHeaders ?? (await headers());
  const session = await getAuth().api.getSession({ headers: resolvedHeaders });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      disabled: true,
      role: true,
    },
  });
  if (!user || user.disabled || !user.emailVerified) return null;
  return user;
}
export async function requireUser(requestHeaders?: Headers) {
  const user = await currentUser(requestHeaders);
  if (!user)
    throw new ServiceError(401, "UNAUTHORIZED", "請先登入並驗證電子郵件。");
  return user;
}
export async function requireReviewer(requestHeaders?: Headers) {
  const user = await requireUser(requestHeaders);
  if (!["SUPER_ADMIN", "ADMIN", "STAFF"].includes(user.role))
    throw new ServiceError(403, "FORBIDDEN", "沒有審核權限。");
  return user;
}
export function assertSameOrigin(request: Request) {
  if (
    request.headers.get("origin") !==
    new URL(process.env.BETTER_AUTH_URL!).origin
  )
    throw new ServiceError(403, "INVALID_ORIGIN", "請從本站送出操作。");
}
export async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new ServiceError(400, "INVALID_JSON", "資料格式無效。");
  const decoder = new TextDecoder();
  let text = "",
    size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new ServiceError(413, "PAYLOAD_TOO_LARGE", "資料超過大小限制。");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text);
  } catch {
    throw new ServiceError(400, "INVALID_JSON", "資料格式無效。");
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function handleError(error: unknown) {
  if (error instanceof ServiceError)
    return json(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  if (error && typeof error === "object" && "issues" in error)
    return json(
      { error: { code: "VALIDATION_ERROR", message: "請檢查輸入欄位。" } },
      400,
    );
  console.error(
    "Member service failure:",
    error instanceof Error ? error.name : "Unknown",
  );
  return json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "服務暫時無法完成，請稍後重試。",
      },
    },
    500,
  );
}

export async function requireAdmin(
  capability: import("@/lib/admin-permissions").Capability,
  requestHeaders?: Headers,
) {
  const user = await requireUser(requestHeaders);
  const { canAdmin } = await import("@/lib/admin-permissions");
  if (!canAdmin(user.role, capability))
    throw new ServiceError(403, "FORBIDDEN", "沒有此後台功能的權限。");
  return user;
}
