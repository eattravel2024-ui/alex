import { getAuth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { readJson, handleError } from "@/lib/server/access";
import { db } from "@/lib/server/db";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}
export async function POST(request: Request) {
  try {
    await readJson(request.clone());
  } catch (error) {
    return handleError(error);
  }

  const session = await getAuth().api.getSession({ headers: request.headers });
  if (session) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { disabled: true },
    });
    if (!user || user.disabled) {
      await db.session.deleteMany({ where: { userId: session.user.id } });
      return Response.json(
        { error: "帳號目前無法使用。" },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  return toNextJsHandler(getAuth()).POST(request);
}
