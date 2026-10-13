import {
  requireUser,
  assertSameOrigin,
  readJson,
  json,
  handleError,
} from "@/lib/server/access";
import { memberDashboard, updateProfile } from "@/lib/services/member-service";
import { profileSchema } from "@/lib/validation";
export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    return json(await memberDashboard(user.id));
  } catch (error) {
    return handleError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request.headers);
    return json(
      await updateProfile(
        user.id,
        profileSchema.parse(await readJson(request)),
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
