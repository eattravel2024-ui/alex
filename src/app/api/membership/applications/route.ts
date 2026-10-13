import {
  requireUser,
  assertSameOrigin,
  readJson,
  json,
  handleError,
} from "@/lib/server/access";
import { submitApplication } from "@/lib/services/member-service";
import { applicationSchema } from "@/lib/validation";
import { db } from "@/lib/server/db";
export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    return json(
      await db.membershipApplication.findMany({
        where: { userId: user.id },
        include: { type: true, history: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request.headers);
    return json(
      await submitApplication(
        user.id,
        applicationSchema.parse(await readJson(request)),
      ),
      201,
    );
  } catch (error) {
    return handleError(error);
  }
}
