import {
  requireAdmin,
  assertSameOrigin,
  readJson,
  json,
  handleError,
} from "@/lib/server/access";
import { eventSchema } from "@/lib/event-validation";
import { saveEvent } from "@/lib/services/event-service";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin("events", request.headers);
    return json(
      await saveEvent(
        actor.id,
        eventSchema.parse(await readJson(request, 32768)),
      ),
      201,
    );
  } catch (error) {
    return handleError(error);
  }
}
