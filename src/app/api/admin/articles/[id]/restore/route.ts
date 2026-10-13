import { z } from "zod";
import {
  assertSameOrigin,
  requireAdmin,
  readJson,
  json,
  handleError,
} from "@/lib/server/access";
import { restoreArticle } from "@/lib/services/article-cms-service";
const schema = z
  .object({ version: z.number().int().positive(), revisionId: z.uuid() })
  .strict();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdmin("content", request.headers);
    const id = z.uuid().parse((await params).id);
    const input = schema.parse(await readJson(request));
    return json(
      await restoreArticle(actor.id, id, input.revisionId, input.version),
    );
  } catch (error) {
    return handleError(error);
  }
}
