import { z } from "zod";
import { contactUpdateSchema } from "@/lib/contact-validation";
import { updateContact } from "@/lib/services/contact-service";
import { assertSameOrigin, requireAdmin, readJson, json, handleError } from "@/lib/server/access";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin("contacts", request.headers);
    const id = z.uuid().parse((await params).id);
    return json(await updateContact(actor.id, id, contactUpdateSchema.parse(await readJson(request))));
  } catch (error) { return handleError(error); }
}
