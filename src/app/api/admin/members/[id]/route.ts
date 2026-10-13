import { z } from "zod";
import {
  assertSameOrigin,
  requireAdmin,
  readJson,
  json,
  handleError,
} from "@/lib/server/access";
import { setMemberDisabled } from "@/lib/services/admin-service";
const schema = z
  .object({
    disabled: z.boolean(),
    expectedDisabled: z.boolean(),
    note: z.string().trim().min(2).max(500),
  })
  .strict();
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin("members", request.headers);
    const id = z.uuid().parse((await params).id);
    const input = schema.parse(await readJson(request));
    return json(
      await setMemberDisabled(
        actor.id,
        id,
        input.disabled,
        input.expectedDisabled,
        input.note,
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
