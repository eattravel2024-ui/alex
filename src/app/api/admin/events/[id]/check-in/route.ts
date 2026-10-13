import { z } from "zod";
import {
  requireAdmin,
  assertSameOrigin,
  readJson,
  json,
  handleError,
} from "@/lib/server/access";
import { checkInEvent } from "@/lib/services/event-service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin("eventOperations", request.headers);
    const input = z
      .object({ registrationId: z.uuid() })
      .strict()
      .parse(await readJson(request));
    return json(
      await checkInEvent(
        actor.id,
        z.uuid().parse((await params).id),
        input.registrationId,
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
