import { z } from "zod";
import {
  requireUser,
  assertSameOrigin,
  json,
  handleError,
} from "@/lib/server/access";
import {
  registerEvent,
  cancelRegistration,
} from "@/lib/services/event-service";
async function mutate(
  request: Request,
  params: Promise<{ id: string }>,
  cancel: boolean,
) {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request.headers);
    const id = z.uuid().parse((await params).id);
    return json(
      cancel
        ? await cancelRegistration(user.id, id)
        : await registerEvent(user.id, id),
      cancel ? 200 : 201,
    );
  } catch (error) {
    return handleError(error);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return mutate(request, params, false);
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return mutate(request, params, true);
}
