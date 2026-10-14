import { z } from "zod";
import { requireAdmin, assertSameOrigin, readJson, json, handleError } from "@/lib/server/access";
import { mediaAltSchema, mediaIdSchema } from "@/lib/media-validation";
import { updateMedia, deleteMedia } from "@/lib/services/media-service";
const editSchema = z.object({ altText: mediaAltSchema, version: z.number().int().positive() }).strict();
const deleteSchema = editSchema.pick({ version: true });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin("content", request.headers);
    const id = mediaIdSchema.parse((await params).id);
    const input = editSchema.parse(await readJson(request));
    return json(await updateMedia(actor.id, id, input.altText, input.version));
  } catch (error) { return handleError(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin("content", request.headers);
    const id = mediaIdSchema.parse((await params).id);
    const input = deleteSchema.parse(await readJson(request));
    return json(await deleteMedia(actor.id, id, input.version));
  } catch (error) { return handleError(error); }
}
