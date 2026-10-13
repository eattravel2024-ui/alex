import { z } from "zod";
import { pageKeys, pageContentSchema } from "@/lib/site-pages";
import { savePage } from "@/lib/services/site-page-service";
import { assertSameOrigin, requireAdmin, readJson, json, handleError } from "@/lib/server/access";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["SAVE", "PUBLISH"]), version: z.number().int().min(0), content: pageContentSchema }).strict(),
  z.object({ action: z.literal("RESTORE"), version: z.number().int().min(1), revisionId: z.uuid() }).strict(),
]);
export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin("content", request.headers);
    const key = pageKeys.parse((await params).key);
    const input = schema.parse(await readJson(request, 65536));
    return json(await savePage(actor.id, key, input.version, input.action, "content" in input ? input.content : undefined, "revisionId" in input ? input.revisionId : undefined));
  } catch (error) { return handleError(error); }
}
