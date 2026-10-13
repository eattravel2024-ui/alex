import {
  requireUser,
  assertSameOrigin,
  json,
  handleError,
  ServiceError,
} from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { z } from "zod";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request.headers);
    const result = await db.session.deleteMany({
      where: { id: z.uuid().parse((await params).id), userId: user.id },
    });
    if (!result.count)
      throw new ServiceError(404, "NOT_FOUND", "找不到這筆登入。");
    return json({ revoked: true });
  } catch (error) {
    return handleError(error);
  }
}
