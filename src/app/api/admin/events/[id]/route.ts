import { z } from "zod";
import {
  requireAdmin,
  assertSameOrigin,
  readJson,
  json,
  handleError,
} from "@/lib/server/access";
import { eventUpdateSchema } from "@/lib/event-validation";
import { saveEvent } from "@/lib/services/event-service";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin("events", request.headers);
    const { version, ...input } = eventUpdateSchema.parse(
      await readJson(request, 32768),
    );
    return json(
      await saveEvent(
        actor.id,
        input,
        z.uuid().parse((await params).id),
        version,
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
